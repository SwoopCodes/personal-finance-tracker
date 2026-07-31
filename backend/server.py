from flask import Flask, g, session, request, jsonify
from flask import send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException
import bcrypt
import psycopg2
import os
from datetime import datetime, timedelta, date
import stocks
from dotenv import load_dotenv
load_dotenv()


app = Flask(__name__, static_folder='../frontend/build', static_url_path='')

app.secret_key = os.environ.get('SECRET_KEY')
if not app.secret_key:
    raise RuntimeError(
        "SECRET_KEY environment variable must be set (session cookies are "
        "signed with it; an unset/guessable secret allows session forgery)."
    )

IS_PRODUCTION = os.environ.get('FLASK_ENV') == 'production'

app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# Secure requires HTTPS; local dev runs over plain http://localhost, so this
# only turns on when FLASK_ENV=production is explicitly set.
app.config['SESSION_COOKIE_SECURE'] = IS_PRODUCTION

CORS(app, 
     supports_credentials=True, 
     origins=["http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:5000"],
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

limiter = Limiter(app=app, key_func=get_remote_address, default_limits=[])

ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:5000"]

@app.before_request
def check_origin_for_state_changes():
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        origin = request.headers.get('Origin') or request.headers.get('Referer')
        if not origin or not any(origin.startswith(allowed) for allowed in ALLOWED_ORIGINS):
            return jsonify({"error": "Forbidden"}), 403

def get_db():
    if 'db' not in g:
        g.db = psycopg2.connect(
            database=os.environ.get('DB_NAME', 'finance_program'),
            user=os.environ.get('DB_USER', 'postgres'),
            password=os.environ.get('DB_PASSWORD', 'password'),
            host=os.environ.get('DB_HOST', 'localhost'),
            port=os.environ.get('DB_PORT', '5432')
        )
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

@app.errorhandler(Exception)
def handle_unexpected_error(e):
    if isinstance(e, HTTPException):
        # Let Flask/extensions' own HTTP errors (404, 429 rate limit, etc.)
        # pass through unchanged instead of being masked as a generic 500.
        return e
    app.logger.exception("Unhandled exception")
    db = g.get('db', None)
    if db is not None:
        try:
            db.rollback()
        except Exception:
            pass
    return jsonify({"error": "An unexpected error occurred"}), 500

@app.errorhandler(429)
def handle_rate_limit(e):
    return jsonify({"error": "Too many attempts, please try again later"}), 429

# Keep in sync with frontend/src/Components/FinanceOverview/categories.js
EXPENSE_CATEGORIES = [
    'Rent/Mortgage', 'Utilities', 'Groceries', 'Dining Out', 'Transportation',
    'Entertainment', 'Subscriptions', 'Shopping', 'Healthcare', 'Insurance',
    'Debt Payment', 'Education', 'Travel', 'Personal Care', 'Gifts & Donations',
    'Recurring Bills', 'Uncategorized', 'Miscellaneous'
]
INCOME_CATEGORIES = [
    'Salary', 'Bonus', 'Freelance/Business', 'Investment Income',
    'Gift Received', 'Refund', 'Uncategorized', 'Other Income'
]

def build_daily_series(start_date, end_date, rows, starting_balance):
    """Zero-filled daily chart series from start_date to end_date inclusive.
    rows: iterable of (transaction_date, signed amount) tuples.
    All monetary values are cast to float so Flask's JSON encoder emits
    numbers instead of stringified Decimals (psycopg2 returns Decimal for
    numeric columns, and Flask's default JSON provider serializes those as
    strings, not numbers)."""
    per_day = {}
    for txn_date, amt in rows:
        amt = float(amt)
        if isinstance(txn_date, datetime):
            txn_date = txn_date.date()
        entry = per_day.setdefault(txn_date, {'income': 0.0, 'expense': 0.0})
        if amt >= 0:
            entry['income'] += amt
        else:
            entry['expense'] += abs(amt)

    chart_data = []
    total_income = 0.0
    total_expense = 0.0
    cumulative = float(starting_balance)
    current = start_date
    while current <= end_date:
        day = per_day.get(current, {'income': 0, 'expense': 0})
        cumulative += day['income'] - day['expense']
        chart_data.append({
            'date': current.isoformat(),
            'income': day['income'],
            'expense': day['expense'],
            'balance': cumulative
        })
        total_income += day['income']
        total_expense += day['expense']
        current += timedelta(days=1)

    return chart_data, total_income, total_expense

def compute_positions(rows):
    """rows: iterable of (ticker, transaction_type, shares, price_per_share, transaction_date),
    any order. Returns {ticker: {'shares': float, 'avgCost': float}} for tickers currently
    held (shares > 0), using the standard average-cost-basis method: BUY updates the running
    weighted average, SELL reduces shares without changing the average cost of what remains."""
    by_ticker = {}
    for ticker, ttype, shares, price, txn_date in sorted(rows, key=lambda r: r[4]):
        shares = float(shares)
        price = float(price)
        pos = by_ticker.setdefault(ticker, {'shares': 0.0, 'avgCost': 0.0})
        if ttype == 'BUY':
            total_cost = pos['avgCost'] * pos['shares'] + price * shares
            pos['shares'] += shares
            pos['avgCost'] = total_cost / pos['shares'] if pos['shares'] > 0 else 0.0
        else:
            pos['shares'] -= shares
            if pos['shares'] <= 1e-9:
                pos['shares'] = 0.0
    return {t: p for t, p in by_ticker.items() if p['shares'] > 1e-9}

def compute_realized_pl(rows):
    """rows: same shape as compute_positions. Replays BUY/SELL chronologically per
    ticker with the same average-cost method, and sums realized P/L across every
    SELL: (sell_price - avg_cost_at_time_of_sale) * shares_sold. Kept separate from
    compute_positions to avoid touching its existing call sites."""
    by_ticker = {}
    realized = 0.0
    for ticker, ttype, shares, price, txn_date in sorted(rows, key=lambda r: r[4]):
        shares = float(shares)
        price = float(price)
        pos = by_ticker.setdefault(ticker, {'shares': 0.0, 'avgCost': 0.0})
        if ttype == 'BUY':
            total_cost = pos['avgCost'] * pos['shares'] + price * shares
            pos['shares'] += shares
            pos['avgCost'] = total_cost / pos['shares'] if pos['shares'] > 0 else 0.0
        else:
            realized += (price - pos['avgCost']) * shares
            pos['shares'] -= shares
            if pos['shares'] <= 1e-9:
                pos['shares'] = 0.0
    return realized

def _timeframe_start_date(timeframe, rows):
    """Resolves a timeframe string to a start date. 'all' uses the actual
    earliest transaction date in `rows` rather than a fixed lookback."""
    today = date.today()
    if timeframe == 'all':
        return min(r[4] for r in rows) if rows else today
    days_map = {
        '1d': 2, '1w': 7, '1m': 30, '3m': 90, '1y': 365,
        'ytd': (today - date(today.year, 1, 1)).days + 1
    }
    days = days_map.get(timeframe, 30)
    return today - timedelta(days=days - 1)

def _closest_close(history_dict, date_str):
    if date_str in history_dict:
        return history_dict[date_str]
    d = date.fromisoformat(date_str)
    for back in range(1, 8):
        candidate = (d - timedelta(days=back)).isoformat()
        if candidate in history_dict:
            return history_dict[candidate]
    return None

def build_portfolio_value_series(rows, start_date, history_period=None):
    """Reconstructs a daily portfolio-value series from start_date to today.
    Walks every ticker that ever appears in `rows`, not just currently-open
    positions — a closed position still contributes its history up to the day
    it was sold, then correctly stays at $0 rather than the whole series
    disappearing once nothing is left open."""
    if not rows:
        return []

    today = date.today()
    days = (today - start_date).days + 1
    if history_period is None:
        history_period = '3mo' if days <= 90 else ('1y' if days <= 365 else 'max')

    tickers = sorted({r[0] for r in rows})

    txns_by_ticker = {}
    for ticker, ttype, shares, price, txn_date in rows:
        txns_by_ticker.setdefault(ticker, []).append((txn_date, ttype, float(shares)))
    for t in txns_by_ticker:
        txns_by_ticker[t].sort(key=lambda x: x[0])

    history_by_ticker = {}
    for ticker in tickers:
        hist = stocks.get_history(ticker, history_period)
        history_by_ticker[ticker] = {h['date']: h['close'] for h in hist}

    idx = {t: 0 for t in tickers}
    shares_held = {t: 0.0 for t in tickers}

    series = []
    current = start_date
    while current <= today:
        for ticker in tickers:
            txns = txns_by_ticker.get(ticker, [])
            while idx.get(ticker, 0) < len(txns) and txns[idx[ticker]][0] <= current:
                _, ttype, txn_shares = txns[idx[ticker]]
                if ttype == 'BUY':
                    shares_held[ticker] = shares_held.get(ticker, 0.0) + txn_shares
                else:
                    shares_held[ticker] = shares_held.get(ticker, 0.0) - txn_shares
                idx[ticker] += 1

        date_str = current.isoformat()
        day_value = 0.0
        for ticker in tickers:
            held = shares_held.get(ticker, 0.0)
            if held <= 0:
                continue
            price = _closest_close(history_by_ticker.get(ticker, {}), date_str)
            if price is not None:
                day_value += held * price
        series.append({'date': date_str, 'value': round(day_value, 2)})
        current += timedelta(days=1)

    return series

# ---------- REGISTER ----------
@app.route('/api/register', methods=['POST'])
@limiter.limit("10 per minute")
def registerUser():
    if request.method == "POST":
        username = request.form.get('username-input')
        email = request.form.get('email-input')
        password = request.form.get('password-input')

        if not username or not email or not password:
            return jsonify({
                'success': False,
                'message': 'Username, email, and password are required'
            }), 400

        try:
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            hashed_password_str = hashed_password.decode('utf-8')

            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO customers (username, email, password) VALUES (%s, %s, %s)",
                (username, email, hashed_password_str)
            )
            conn.commit()
            cur.close()

            return jsonify({
                'success': True,
                'message': 'Registration successful!'
            }), 201

        except Exception as e:
            app.logger.exception("Registration failed")
            return jsonify({
                'success': False,
                'message': 'Registration failed. Please try again.'
            }), 500

    return jsonify({
        'success': False,
        'message': 'Invalid request method'
    }), 405

# ---------- LOGIN ----------
@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per minute")
def Login():
    if request.method == "POST":
        username = request.form.get('username-input')
        password = request.form.get('password-input')
        invalid_credentials_response = jsonify({
            'success': False,
            'message': 'Invalid username or password'
        }), 401

        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                "SELECT customer_id, username, password FROM customers WHERE username = %s",
                (username,)
            )
            user = cur.fetchone()
            cur.close()

            if user is None:
                return invalid_credentials_response

            db_password_hash = user[2]

            is_valid = bcrypt.checkpw(
                password.encode('utf-8'),
                db_password_hash.encode('utf-8')
            )

            if is_valid:
                session['user_id'] = user[0]
                session.permanent = True
                return jsonify({
                    'success': True,
                    'message': 'Login successful!',
                }), 200
            else:
                return invalid_credentials_response

        except Exception as e:
            app.logger.exception("Login failed")
            return jsonify({
                'success': False,
                'message': 'Login failed. Please try again.'
            }), 500

# ---------- GET ACCOUNT BALANCE ----------
@app.route('/api/user-account-balance', methods=['GET'])
def get_user_data():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT * from accounts WHERE customer_id = %s",
        (session['user_id'],)
    )
    account = cur.fetchone()
    cur.close()
    conn.close()

    if account is None:
        return jsonify({
            'success': False,
            'message': 'No account found'
        }), 404
    else:
        return jsonify({
            "user_id": session['user_id'],
            "account_name": account[2],
            "account_balance": float(account[3])
        })

# ---------- CREATE ACCOUNT ----------
@app.route('/api/create-account', methods=['POST'])
def create_account():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    account_name = data.get('account_name')
    balance = data.get('balance')

    if not account_name or balance is None:
        return jsonify({"error": "Missing account name or balance"}), 400

    try:
        balance = float(balance)
    except ValueError:
        return jsonify({"error": "Invalid balance amount"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO accounts (customer_id, account_name, balance) VALUES (%s, %s, %s) RETURNING account_id",
        (session['user_id'], account_name, balance)
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "id": new_id,
        "name": account_name,
        "balance": balance
    }), 201

# ---------- LOGOUT ----------
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True})        

# ---------- GET ACCOUNTS ----------
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT account_id, account_name, balance FROM accounts WHERE customer_id = %s ORDER BY account_id",
        (session['user_id'],)
    )
    accounts = cur.fetchall()
    cur.close()
    conn.close()

    result = [{"id": acc[0], "name": acc[1], "balance": float(acc[2])} for acc in accounts]
    return jsonify(result)

# ---------- GET TRANSACTIONS ----------
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    account_id = request.args.get('account_id')
    if not account_id:
        return jsonify({"error": "account_id required"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT customer_id FROM accounts WHERE account_id = %s",
        (account_id,)
    )
    owner = cur.fetchone()
    if not owner or owner[0] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    cur.execute(
        "SELECT transaction_id, amount, type, category, description, transaction_date "
        "FROM finance_transactions WHERE account_id = %s ORDER BY transaction_date DESC",
        (account_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    transactions = [{
        "id": row[0],
        "amount": float(row[1]),
        "type": row[2],
        "category": row[3],
        "description": row[4],
        "date": row[5].isoformat() if row[5] else None
    } for row in rows]

    return jsonify(transactions)

# ---------- ADD TRANSACTION ----------
@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    account_id = data.get('account_id')
    amount = data.get('amount')
    trans_type = data.get('type')
    category = data.get('category', '')
    description = data.get('description', '')
    transaction_date = data.get('date')

    if not account_id or amount is None or not trans_type:
        return jsonify({"error": "Missing required fields"}), 400

    if trans_type not in ('expense', 'income'):
        return jsonify({"error": "Invalid transaction type"}), 400

    valid_categories = EXPENSE_CATEGORIES if trans_type == 'expense' else INCOME_CATEGORIES
    if not category or category not in valid_categories:
        return jsonify({"error": "Missing or invalid category"}), 400

    try:
        amount = float(amount)
        if trans_type == 'expense':
            amount = -abs(amount)
        else:
            amount = abs(amount)
    except ValueError:
        return jsonify({"error": "Invalid amount"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT customer_id FROM accounts WHERE account_id = %s",
        (account_id,)
    )
    owner = cur.fetchone()
    if not owner or owner[0] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    if not transaction_date:
        transaction_date = date.today().isoformat()

    cur.execute(
        "INSERT INTO finance_transactions (account_id, amount, type, category, transaction_date, description) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING transaction_id",
        (account_id, amount, trans_type, category, transaction_date, description)
    )
    new_id = cur.fetchone()[0]

    cur.execute(
        "UPDATE accounts SET balance = balance + %s WHERE account_id = %s",
        (amount, account_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"id": new_id, "message": "Transaction added"}), 201

# ---------- DELETE ACCOUNT ----------
@app.route('/api/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT customer_id FROM accounts WHERE account_id = %s",
        (account_id,)
    )
    owner = cur.fetchone()
    if not owner or owner[0] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    cur.execute(
        "DELETE FROM accounts WHERE account_id = %s",
        (account_id,)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True}), 200

# ---------- DELETE TRANSACTION ----------
@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT account_id, amount FROM finance_transactions WHERE transaction_id = %s",
        (transaction_id,)
    )
    txn = cur.fetchone()
    if not txn:
        cur.close()
        conn.close()
        return jsonify({"error": "Transaction not found"}), 404

    account_id = txn[0]
    amount = txn[1]

    cur.execute(
        "SELECT customer_id FROM accounts WHERE account_id = %s",
        (account_id,)
    )
    owner = cur.fetchone()
    if not owner or owner[0] != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    cur.execute(
        "DELETE FROM finance_transactions WHERE transaction_id = %s",
        (transaction_id,)
    )
    cur.execute(
        "UPDATE accounts SET balance = balance - %s WHERE account_id = %s",
        (amount, account_id)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "success": True,
        "account_id": account_id,
        "amount_removed": amount
    }), 200

# ---------- FINANCE CHART DATA ----------
@app.route('/api/finance/chart-data', methods=['GET'])
def get_finance_chart_data():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    account_id = request.args.get('account_id')
    timeframe = request.args.get('timeframe', '1m')

    if not account_id:
        return jsonify({"error": "account_id required"}), 400

    # Verify account ownership
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT customer_id, balance FROM accounts WHERE account_id = %s",
        (account_id,)
    )
    result = cur.fetchone()
    if not result:
        cur.close()
        conn.close()
        return jsonify({"error": "Account not found"}), 404

    owner_id, current_account_balance = result
    current_account_balance = float(current_account_balance)
    if owner_id != session['user_id']:
        cur.close()
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    # Compute date range
    today = date.today()
    if timeframe == '1d':
        start_date = today
    elif timeframe == '1w':
        start_date = today - timedelta(days=7)
    elif timeframe == '1m':
        start_date = today - timedelta(days=30)
    elif timeframe == '3m':
        start_date = today - timedelta(days=90)
    elif timeframe == '1y':
        start_date = today - timedelta(days=365)
    elif timeframe == 'ytd':
        start_date = date(today.year, 1, 1)
    else:  # 'all'
        cur.execute(
            "SELECT MIN(transaction_date) FROM finance_transactions WHERE account_id = %s",
            (account_id,)
        )
        start_date = cur.fetchone()[0]

    if start_date is None:
        # 'all' timeframe with no transactions yet
        cur.close()
        conn.close()
        return jsonify({
            'chartData': [],
            'totalIncome': 0,
            'totalExpense': 0,
            'currentBalance': current_account_balance
        }), 200

    # Fetch transactions in the period
    cur.execute(
        "SELECT transaction_date, amount FROM finance_transactions "
        "WHERE account_id = %s AND transaction_date >= %s ORDER BY transaction_date",
        (account_id, start_date)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Starting balance at the beginning of the period
    period_sum = float(sum(amt for _, amt in rows))
    starting_balance = current_account_balance - period_sum

    chart_data, total_income, total_expense = build_daily_series(
        start_date, today, rows, starting_balance
    )

    return jsonify({
        'chartData': chart_data,
        'totalIncome': total_income,
        'totalExpense': total_expense,
        'currentBalance': current_account_balance
    }), 200

# ---------- DASHBOARD SUMMARY (all accounts, last 30 days) ----------
@app.route('/api/finance/dashboard-summary', methods=['GET'])
def get_dashboard_summary():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT account_id, balance FROM accounts WHERE customer_id = %s",
        (session['user_id'],)
    )
    accounts = cur.fetchall()

    if not accounts:
        cur.close()
        conn.close()
        return jsonify({
            'totalBalance': 0.0,
            'chartData': [],
            'totalIncome': 0.0,
            'totalExpense': 0.0
        }), 200

    account_ids = [acc[0] for acc in accounts]
    total_balance = sum(acc[1] for acc in accounts)

    today = date.today()
    start_date = today - timedelta(days=30)

    cur.execute(
        "SELECT transaction_date, amount FROM finance_transactions "
        "WHERE account_id = ANY(%s) AND transaction_date >= %s ORDER BY transaction_date",
        (account_ids, start_date)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    period_sum = sum(amt for _, amt in rows)
    starting_balance = total_balance - period_sum

    chart_data, total_income, total_expense = build_daily_series(
        start_date, today, rows, starting_balance
    )

    return jsonify({
        'totalBalance': float(total_balance),
        'chartData': chart_data,
        'totalIncome': total_income,
        'totalExpense': total_expense
    }), 200

# ---------- FINANCE ONBOARDING STATUS ----------
@app.route('/api/finance/onboarding-status', methods=['GET'])
def get_finance_onboarding_status():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT EXISTS(SELECT 1 FROM accounts WHERE customer_id = %s)",
        (session['user_id'],)
    )
    has_history = cur.fetchone()[0]
    cur.close()
    conn.close()

    return jsonify({"hasHistory": bool(has_history)}), 200

# ---------- LIST INVESTMENTS (open positions) ----------
@app.route('/api/investments', methods=['GET'])
def get_investments():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s",
        (session['user_id'],)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    positions = compute_positions(rows)
    result = []
    for ticker, pos in positions.items():
        quote = stocks.get_quote(ticker)
        price = quote['price'] if quote else pos['avgCost']
        day_change_pct = quote['dayChangePct'] if quote else 0.0
        market_value = pos['shares'] * price
        cost_basis = pos['shares'] * pos['avgCost']
        unrealized_pl = market_value - cost_basis
        unrealized_pl_pct = (unrealized_pl / cost_basis * 100) if cost_basis else 0.0
        result.append({
            'ticker': ticker,
            'name': stocks.get_name(ticker),
            'shares': pos['shares'],
            'avgCost': pos['avgCost'],
            'currentPrice': price,
            'dayChangePct': day_change_pct,
            'marketValue': market_value,
            'costBasis': cost_basis,
            'unrealizedPL': unrealized_pl,
            'unrealizedPLPct': unrealized_pl_pct,
        })

    result.sort(key=lambda r: r['marketValue'], reverse=True)
    return jsonify(result), 200

# ---------- INVESTMENTS SUMMARY (dashboard aggregate) ----------
@app.route('/api/investments/summary', methods=['GET'])
def get_investments_summary():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s",
        (session['user_id'],)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    positions = compute_positions(rows)
    if not positions:
        return jsonify({
            'success': False,
            'message': 'No investments found'
        }), 404

    total_value = 0.0
    total_invested = 0.0
    for ticker, pos in positions.items():
        quote = stocks.get_quote(ticker)
        price = quote['price'] if quote else pos['avgCost']
        total_value += pos['shares'] * price
        total_invested += pos['shares'] * pos['avgCost']

    total_pl = total_value - total_invested
    total_pl_pct = (total_pl / total_invested * 100) if total_invested else 0.0
    chart_data = build_portfolio_value_series(rows, date.today() - timedelta(days=29))

    return jsonify({
        'totalValue': total_value,
        'totalInvested': total_invested,
        'totalPL': total_pl,
        'totalPLPct': total_pl_pct,
        'chartData': chart_data
    }), 200

# ---------- SEARCH TICKERS ----------
@app.route('/api/investments/search', methods=['GET'])
def search_investments():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])

    return jsonify(stocks.search_tickers(query))

# ---------- ADD INVESTMENT TRANSACTION (BUY/SELL) ----------
@app.route('/api/investments/transactions', methods=['POST'])
def add_investment_transaction():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    ticker = (data.get('ticker') or '').strip().upper()
    ttype = data.get('type')
    shares = data.get('shares')
    amount = data.get('amount')
    custom_price = data.get('customPrice')
    txn_date = data.get('date')

    if not ticker or ttype not in ('BUY', 'SELL'):
        return jsonify({"error": "Missing or invalid ticker/type"}), 400

    if not stocks.validate_ticker(ticker):
        return jsonify({"error": f"Unknown ticker: {ticker}"}), 400

    quote = stocks.get_quote(ticker)
    live_price = quote['price'] if quote else None

    if custom_price is not None:
        try:
            custom_price = float(custom_price)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid customPrice"}), 400

    price_per_share = custom_price if custom_price else live_price
    if not price_per_share or price_per_share <= 0:
        return jsonify({"error": "Could not determine a price for this ticker"}), 400

    if shares is not None:
        try:
            shares = float(shares)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid shares"}), 400
    elif amount is not None:
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid amount"}), 400
        shares = amount / price_per_share
    else:
        return jsonify({"error": "Provide shares or amount"}), 400

    if shares <= 0:
        return jsonify({"error": "Shares must be positive"}), 400

    if not txn_date:
        txn_date = date.today().isoformat()

    conn = get_db()
    cur = conn.cursor()

    if ttype == 'SELL':
        # Known limitation: this check-then-insert isn't wrapped in row
        # locking, so two concurrent SELL requests could both pass the
        # sufficient-shares check before either commits. Deferred as
        # low-priority given this app has no concurrent-session use case today.
        cur.execute(
            "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
            "FROM investment_transactions WHERE customer_id = %s AND ticker = %s",
            (session['user_id'], ticker)
        )
        held_rows = cur.fetchall()
        positions = compute_positions(held_rows)
        held = positions.get(ticker, {}).get('shares', 0.0)
        if shares > held + 1e-9:
            cur.close()
            conn.close()
            return jsonify({"error": "Insufficient shares"}), 400

    cur.execute(
        "INSERT INTO investment_transactions "
        "(customer_id, ticker, transaction_type, shares, price_per_share, transaction_date) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING investment_txn_id",
        (session['user_id'], ticker, ttype, shares, price_per_share, txn_date)
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "id": new_id,
        "ticker": ticker,
        "shares": shares,
        "pricePerShare": price_per_share
    }), 201

def _shares_held_as_of(cur, customer_id, ticker, as_of_date):
    """Replays investment_transactions up to (and including) as_of_date through
    compute_positions() to determine shares held at that point in time."""
    cur.execute(
        "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s AND ticker = %s "
        "AND transaction_date <= %s",
        (customer_id, ticker, as_of_date)
    )
    rows = cur.fetchall()
    positions = compute_positions(rows)
    return positions.get(ticker, {}).get('shares', 0.0)

# ---------- RECORD DIVIDEND ----------
@app.route('/api/investments/dividends', methods=['POST'])
def add_dividend():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    if data is None:
        return jsonify({"error": "Invalid or missing JSON body"}), 400
    ticker = (data.get('ticker') or '').strip().upper()
    payment_date = data.get('date')
    amount_per_share = data.get('amountPerShare')
    total_amount = data.get('totalAmount')

    if not ticker or not payment_date:
        return jsonify({"error": "Missing ticker or date"}), 400

    if not stocks.validate_ticker(ticker):
        return jsonify({"error": f"Unknown ticker: {ticker}"}), 400

    conn = get_db()
    cur = conn.cursor()

    shares_held = _shares_held_as_of(cur, session['user_id'], ticker, payment_date)
    if shares_held <= 0:
        cur.close()
        conn.close()
        return jsonify({"error": "No shares held as of this date"}), 400

    if amount_per_share is not None:
        try:
            amount_per_share = float(amount_per_share)
        except (TypeError, ValueError):
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid amountPerShare"}), 400
        total_amount = amount_per_share * shares_held
    elif total_amount is not None:
        try:
            total_amount = float(total_amount)
        except (TypeError, ValueError):
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid totalAmount"}), 400
        amount_per_share = total_amount / shares_held
    else:
        cur.close()
        conn.close()
        return jsonify({"error": "Provide amountPerShare or totalAmount"}), 400

    if amount_per_share <= 0:
        cur.close()
        conn.close()
        return jsonify({"error": "Amount must be positive"}), 400

    cur.execute(
        "INSERT INTO investment_dividends "
        "(customer_id, ticker, payment_date, amount_per_share, shares_held, total_amount) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING dividend_id",
        (session['user_id'], ticker, payment_date, amount_per_share, shares_held, total_amount)
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "id": new_id,
        "ticker": ticker,
        "date": payment_date,
        "amountPerShare": amount_per_share,
        "sharesHeld": shares_held,
        "totalAmount": total_amount
    }), 201

# ---------- DIVIDEND ESTIMATE (for Record Dividend modal pre-fill) ----------
@app.route('/api/investments/<ticker>/dividend-estimate', methods=['GET'])
def dividend_estimate(ticker):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    ticker = ticker.strip().upper()
    as_of_date = request.args.get('date') or date.today().isoformat()

    conn = get_db()
    cur = conn.cursor()

    shares_held = _shares_held_as_of(cur, session['user_id'], ticker, as_of_date)
    cur.close()
    conn.close()

    div_info = stocks.get_dividend_info(ticker)
    annual_rate = div_info['annualRatePerShare'] if div_info else 0.0
    estimated_amount_per_share = annual_rate / 4
    estimated_total = estimated_amount_per_share * shares_held

    return jsonify({
        "ticker": ticker,
        "date": as_of_date,
        "sharesHeld": shares_held,
        "estimatedAmountPerShare": estimated_amount_per_share,
        "estimatedTotal": estimated_total
    }), 200

# ---------- CLOSE INVESTMENT (full sell) ----------
@app.route('/api/investments/<ticker>/close', methods=['POST'])
def close_investment(ticker):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    ticker = ticker.strip().upper()

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s AND ticker = %s",
        (session['user_id'], ticker)
    )
    rows = cur.fetchall()
    positions = compute_positions(rows)
    held = positions.get(ticker, {}).get('shares', 0.0)

    if held <= 0:
        cur.close()
        conn.close()
        return jsonify({"error": "No open position for this ticker"}), 404

    quote = stocks.get_quote(ticker)
    price = quote['price'] if quote else positions[ticker]['avgCost']

    cur.execute(
        "INSERT INTO investment_transactions "
        "(customer_id, ticker, transaction_type, shares, price_per_share, transaction_date) "
        "VALUES (%s, %s, 'SELL', %s, %s, %s) RETURNING investment_txn_id",
        (session['user_id'], ticker, held, price, date.today().isoformat())
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"id": new_id, "ticker": ticker, "sharesSold": held, "price": price}), 200

# ---------- INVESTMENT DETAIL OVERVIEW ----------
@app.route('/api/investments/<ticker>/overview', methods=['GET'])
def investment_overview(ticker):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    ticker = ticker.strip().upper()
    timeframe = request.args.get('timeframe', '1m')

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT investment_txn_id, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s AND ticker = %s "
        "ORDER BY transaction_date DESC",
        (session['user_id'], ticker)
    )
    txn_rows = cur.fetchall()

    cur.execute(
        "SELECT dividend_id, payment_date, amount_per_share, shares_held, total_amount "
        "FROM investment_dividends WHERE customer_id = %s AND ticker = %s "
        "ORDER BY payment_date DESC",
        (session['user_id'], ticker)
    )
    div_rows = cur.fetchall()

    cur.close()
    conn.close()

    if not txn_rows:
        return jsonify({"error": "No transactions for this ticker"}), 404

    agg_rows = [(ticker, r[1], r[2], r[3], r[4]) for r in txn_rows]
    positions = compute_positions(agg_rows)
    pos = positions.get(ticker, {'shares': 0.0, 'avgCost': 0.0})

    quote = stocks.get_quote(ticker)
    current_price = quote['price'] if quote else pos['avgCost']
    day_change_pct = quote['dayChangePct'] if quote else 0.0

    period_map = {
        '1d': '5d', '1w': '1mo', '1m': '3mo',
        '3m': '6mo', '1y': '1y', 'ytd': 'ytd', 'all': 'max'
    }
    period = period_map.get(timeframe, '3mo')
    chart_data = stocks.get_history(ticker, period)

    full_history = stocks.get_history(ticker, '1y')
    timeframe_changes = stocks.timeframe_changes(full_history or chart_data)

    market_value = pos['shares'] * current_price
    cost_basis = pos['shares'] * pos['avgCost']
    unrealized_pl = market_value - cost_basis
    unrealized_pl_pct = (unrealized_pl / cost_basis * 100) if cost_basis else 0.0

    transactions = [{
        'id': r[0],
        'type': r[1],
        'shares': float(r[2]),
        'pricePerShare': float(r[3]),
        'date': r[4].isoformat() if r[4] else None
    } for r in txn_rows]

    dividend_history = [{
        'id': r[0],
        'date': r[1].isoformat() if r[1] else None,
        'amountPerShare': float(r[2]),
        'sharesHeld': float(r[3]),
        'totalAmount': float(r[4])
    } for r in div_rows]
    total_dividends_received = sum(d['totalAmount'] for d in dividend_history)
    div_info = stocks.get_dividend_info(ticker)
    annual_rate_per_share = div_info['annualRatePerShare'] if div_info else 0.0
    dividend_yield_pct = div_info['yieldOnPricePct'] if div_info else 0.0
    estimated_annual_income = annual_rate_per_share * pos['shares']

    return jsonify({
        'ticker': ticker,
        'name': stocks.get_name(ticker),
        'currentPrice': current_price,
        'dayChangePct': day_change_pct,
        'chartData': chart_data,
        'timeframeChanges': timeframe_changes,
        'position': {
            'shares': pos['shares'],
            'avgCost': pos['avgCost'],
            'marketValue': market_value,
            'costBasis': cost_basis,
            'unrealizedPL': unrealized_pl,
            'unrealizedPLPct': unrealized_pl_pct,
        },
        'transactions': transactions,
        'dividends': {
            'annualRatePerShare': annual_rate_per_share,
            'yieldOnPricePct': dividend_yield_pct,
            'estimatedAnnualIncome': estimated_annual_income,
            'totalReceived': total_dividends_received,
            'history': dividend_history
        }
    }), 200

# ---------- ONBOARDING STATUS ----------
@app.route('/api/investments/onboarding-status', methods=['GET'])
def get_onboarding_status():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT EXISTS(SELECT 1 FROM investment_transactions WHERE customer_id = %s)",
        (session['user_id'],)
    )
    has_history = cur.fetchone()[0]
    cur.close()
    conn.close()

    return jsonify({"hasHistory": bool(has_history)}), 200

# ---------- ACCOUNT-WIDE INVESTMENT STATISTICS ----------
@app.route('/api/investments/stats', methods=['GET'])
def get_investment_stats():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    timeframe = request.args.get('timeframe', '1m')

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s",
        (session['user_id'],)
    )
    rows = cur.fetchall()

    cur.execute(
        "SELECT COALESCE(SUM(total_amount), 0) FROM investment_dividends WHERE customer_id = %s",
        (session['user_id'],)
    )
    total_dividends_earned = float(cur.fetchone()[0])
    cur.close()
    conn.close()

    positions = compute_positions(rows)
    realized_pl = compute_realized_pl(rows)

    total_value = 0.0
    total_invested = 0.0
    day_change_value = 0.0
    total_annual_dividend_income = 0.0
    performers = []
    for ticker, pos in positions.items():
        quote = stocks.get_quote(ticker)
        price = quote['price'] if quote else pos['avgCost']
        day_change_pct = quote['dayChangePct'] if quote else 0.0
        market_value = pos['shares'] * price
        cost_basis = pos['shares'] * pos['avgCost']
        unrealized_pl = market_value - cost_basis
        unrealized_pl_pct = (unrealized_pl / cost_basis * 100) if cost_basis else 0.0
        total_value += market_value
        total_invested += cost_basis
        prev_value = market_value / (1 + day_change_pct / 100) if (1 + day_change_pct / 100) else market_value
        day_change_value += market_value - prev_value
        performers.append({'ticker': ticker, 'unrealizedPLPct': unrealized_pl_pct})
        div_info = stocks.get_dividend_info(ticker)
        if div_info:
            total_annual_dividend_income += div_info['annualRatePerShare'] * pos['shares']

    unrealized_pl = total_value - total_invested
    unrealized_pl_pct = (unrealized_pl / total_invested * 100) if total_invested else 0.0
    total_pl = realized_pl + unrealized_pl
    total_pl_pct = (total_pl / total_invested * 100) if total_invested else 0.0
    prev_total = total_value - day_change_value
    day_change_pct_total = (day_change_value / prev_total * 100) if prev_total else 0.0

    performers.sort(key=lambda p: p['unrealizedPLPct'], reverse=True)
    best_performer = performers[0] if performers else None
    worst_performer = performers[-1] if len(performers) > 1 else None

    start_date = _timeframe_start_date(timeframe, rows)
    chart_data = build_portfolio_value_series(rows, start_date)

    portfolio_dividend_yield_pct = (total_annual_dividend_income / total_value * 100) if total_value else 0.0

    return jsonify({
        'totalValue': total_value,
        'totalInvested': total_invested,
        'unrealizedPL': unrealized_pl,
        'unrealizedPLPct': unrealized_pl_pct,
        'realizedPL': realized_pl,
        'totalPL': total_pl,
        'totalPLPct': total_pl_pct,
        'dayChangeValue': day_change_value,
        'dayChangePct': day_change_pct_total,
        'numPositions': len(positions),
        'bestPerformer': best_performer,
        'worstPerformer': worst_performer,
        'chartData': chart_data,
        'totalDividendsEarned': total_dividends_earned,
        'portfolioDividendYieldPct': portfolio_dividend_yield_pct
    }), 200

# ---------- NET WORTH (combined cash + investments) ----------
@app.route('/api/networth/stats', methods=['GET'])
def get_networth_stats():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    timeframe = request.args.get('timeframe', '1m')

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT account_id, balance FROM accounts WHERE customer_id = %s",
        (session['user_id'],)
    )
    accounts = cur.fetchall()
    account_ids = [a[0] for a in accounts]
    cash_value = float(sum(a[1] for a in accounts)) if accounts else 0.0

    finance_rows = []
    if account_ids:
        cur.execute(
            "SELECT transaction_date, amount FROM finance_transactions "
            "WHERE account_id = ANY(%s) ORDER BY transaction_date",
            (account_ids,)
        )
        finance_rows = cur.fetchall()

    cur.execute(
        "SELECT ticker, transaction_type, shares, price_per_share, transaction_date "
        "FROM investment_transactions WHERE customer_id = %s",
        (session['user_id'],)
    )
    invest_rows = cur.fetchall()
    cur.close()
    conn.close()

    positions = compute_positions(invest_rows)
    investment_value = 0.0
    for ticker, pos in positions.items():
        quote = stocks.get_quote(ticker)
        price = quote['price'] if quote else pos['avgCost']
        investment_value += pos['shares'] * price

    net_worth = cash_value + investment_value

    today = date.today()
    combined_dates = [(r[0], 0) for r in finance_rows] + [(r[0], 0) for r in invest_rows]
    start_date = _timeframe_start_date(timeframe, combined_dates) if combined_dates else today

    window_finance_rows = [(d, amt) for d, amt in finance_rows if d >= start_date]
    period_sum = float(sum(amt for _, amt in window_finance_rows))
    starting_cash = cash_value - period_sum
    cash_chart, _, _ = build_daily_series(start_date, today, window_finance_rows, starting_cash)

    invest_chart = build_portfolio_value_series(invest_rows, start_date)
    invest_by_date = {p['date']: p['value'] for p in invest_chart}

    chart_data = []
    for c in cash_chart:
        d = c['date']
        cash_v = c['balance']
        inv_v = invest_by_date.get(d, 0.0)
        chart_data.append({
            'date': d,
            'cash': round(cash_v, 2),
            'investments': round(inv_v, 2),
            'netWorth': round(cash_v + inv_v, 2)
        })

    if chart_data:
        first = chart_data[0]
        period_change_value = net_worth - first['netWorth']
        period_change_pct = (period_change_value / first['netWorth'] * 100) if first['netWorth'] else 0.0
        cash_period_change_value = cash_value - first['cash']
        investment_period_change_value = investment_value - first['investments']
        high_point = max(chart_data, key=lambda p: p['netWorth'])
        low_point = min(chart_data, key=lambda p: p['netWorth'])
        all_time_high = {'date': high_point['date'], 'value': high_point['netWorth']}
        all_time_low = {'date': low_point['date'], 'value': low_point['netWorth']}
    else:
        period_change_value = 0.0
        period_change_pct = 0.0
        cash_period_change_value = 0.0
        investment_period_change_value = 0.0
        all_time_high = {'date': today.isoformat(), 'value': net_worth}
        all_time_low = {'date': today.isoformat(), 'value': net_worth}

    cash_pct = (cash_value / net_worth * 100) if net_worth else 0.0
    investment_pct = (investment_value / net_worth * 100) if net_worth else 0.0

    return jsonify({
        'netWorth': net_worth,
        'cashValue': cash_value,
        'investmentValue': investment_value,
        'cashPct': cash_pct,
        'investmentPct': investment_pct,
        'periodChangeValue': period_change_value,
        'periodChangePct': period_change_pct,
        'cashPeriodChangeValue': cash_period_change_value,
        'investmentPeriodChangeValue': investment_period_change_value,
        'allTimeHigh': all_time_high,
        'allTimeLow': all_time_low,
        'chartData': chart_data,
        'timeframe': timeframe
    }), 200

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')
    # If the path exists as a file (e.g., /static/js/main.js), serve it
    if path and os.path.exists(os.path.join(frontend_dir, path)):
        return send_from_directory(frontend_dir, path)
    # Otherwise, serve index.html (for client‑side routing)
    return send_from_directory(frontend_dir, 'index.html')

@app.errorhandler(404)
def not_found(e):
    frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')
    return send_from_directory(frontend_dir, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=not IS_PRODUCTION)