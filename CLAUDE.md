# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal finance tracker: a single-file Flask API (`server.py`) backed by PostgreSQL, and a Create React App frontend (`frontend/`) for registration, login, account management, and transaction/chart visualization.

Per `Documentation.pdf` (in the parent `finance_tracker_project/` directory), the product has two halves: **personal finance** (bank accounts, income/expense) and **investment tracking** (stock holdings, live pricing via `yfinance`, unrealized P&L). Both are implemented.

There is no build tooling, test suite, or dependency manifest (no `requirements.txt`) for the backend yet — dependencies are installed ad hoc.

## Running the app

**Backend** (from `program/`):
```bash
python server.py
```
Runs on `http://localhost:5000` with `debug=True`. Requires `flask`, `flask-cors`, `bcrypt`, `psycopg2` (or `psycopg2-binary`), and `yfinance` to be installed in the active Python environment — install manually if missing, there is no lockfile. `yfinance` is an unofficial Yahoo Finance client and can return HTTP 429 under heavy unauthenticated use; `stocks.py` caches every call in-memory (2-5 min TTLs) specifically to stay under that.

Requires a running PostgreSQL instance with a database named `finance_program` (see connection details in `get_db()` in `server.py`: user `postgres`, password `password`, host `localhost`, port `5432`). The schema is not defined anywhere in this repo (no migrations/SQL files) — the database must already have these tables (confirmed live via `psql`):

```
customers (customer_id PK, username, password, email, registration_date)
accounts (account_id PK, customer_id FK -> customers, account_name, balance)
finance_transactions (transaction_id PK, account_id FK -> accounts, amount, type ['income'|'expense'], category, transaction_date, description)
investment_transactions (investment_txn_id PK, customer_id FK -> customers, ticker, transaction_type ['BUY'|'SELL'], shares, price_per_share, transaction_date)
investment_dividends (dividend_id PK, customer_id FK -> customers, ticker, payment_date, amount_per_share numeric(13,4), shares_held numeric(13,4), total_amount numeric(13,2), created_at)
portfolio_snapshots (snapshot_id PK, customer_id FK -> customers, snapshot_date, total_value, total_invested, UNIQUE(customer_id, snapshot_date)) — unused
```

All FKs cascade on delete. `portfolio_snapshots` remains unused. `investment_dividends` was added by hand via `psql` (no migrations system in this repo). A "Pies" feature (Trading212-style named groups of tickers with target % allocations) previously existed — `investment_groups`/`investment_group_targets` tables and a nullable `group_id` FK column on `investment_transactions`/`investment_dividends` — and was removed by hand via `psql` (existing grouped transactions were ungrouped back to standalone via the same `ON DELETE SET NULL` semantics the feature's own delete-pie endpoint used, before the tables/columns were dropped).

**Frontend** (from `program/frontend/`):
```bash
npm start       # dev server on http://localhost:3000, proxies to :5000
npm run build   # production build
npm test        # react-scripts/Jest test runner (no test files currently exist)
```

Both servers must run simultaneously for the app to work — the frontend makes hardcoded fetch calls to `http://localhost:5000`, and CORS on the backend is locked to `http://localhost:3000` (`credentials: 'include'` everywhere, since auth is cookie/session based).

## Architecture

### Backend (`server.py`)

A single flat Flask app — no blueprints, no models, no ORM. Every route does its own inline SQL via `psycopg2`, opening a connection through `get_db()` (stored on Flask's `g`, closed in `teardown_appcontext`). Note: several handlers (e.g. `get_user_data`, `create_account`, `get_accounts`) manually call `conn.close()` themselves *in addition to* the teardown hook — be aware of this when adding new routes so you don't double-close or rely on `g.db` surviving past a manual close.

Auth is server-side session based (Flask `session`, cookie signed with `SECRET_KEY`), not token based. `session['user_id']` is the identity used everywhere; there is no `@login_required` decorator — each protected route repeats the `if 'user_id' not in session: return 401` check manually.

Ownership checks follow a consistent pattern for account/transaction-scoped routes: look up the row, compare its `customer_id` (via the parent account) against `session['user_id']`, return 403 if mismatched, before performing the requested action. Follow this pattern for any new route touching `accounts` or `finance_transactions`.

Money handling: `finance_transactions.amount` is signed (income positive, expense stored as negative) and the `accounts.balance` column is a running total kept in sync by each write — `add_transaction` increments it, `delete_transaction` decrements it by the stored (signed) amount. `/api/finance/chart-data` and `/api/finance/dashboard-summary` reconstruct a historical balance series by working backwards from the *current* balance minus the sum of transactions in the selected window, then walking forward day-by-day via the shared `build_daily_series()` helper — it does not read from a separate balance-history table. Both endpoints zero-fill every calendar day in range (not just days with a transaction), so chart data is continuous.

**Decimal/JSON gotcha:** psycopg2 returns `numeric` columns as Python `Decimal`, and Flask's default JSON encoder serializes `Decimal` as a **string**, not a number (confirmed via `jsonify({'x': Decimal('1.23')})` → `'{"x":"1.23"}'`). Any handler returning a `numeric` column (or arithmetic derived from one) must explicitly `float(...)` it before `jsonify`, or the frontend receives a string and things like `value.toFixed(2)` throw at runtime. `build_daily_series()` and the money-returning routes already do this — follow the same pattern for any new numeric field.

Category validation: `add_transaction` requires `category` to be a non-empty member of `EXPENSE_CATEGORIES` or `INCOME_CATEGORIES` (module-level lists near the top of `server.py`, matching the `type`), returning 400 otherwise. These lists must be kept in sync by hand with `frontend/src/Components/FinanceOverview/categories.js` — there's no shared-code mechanism between the CRA app and Flask app. A one-time backfill (`UPDATE finance_transactions SET category = 'Uncategorized' WHERE category = '';`) was run by hand against `finance_program` to clean up pre-existing blank-category rows from before this validation existed — there's no migrations system in this repo, so any future schema/data fixups need to be run manually via `psql` and noted here.

**Investment tracking** (`stocks.py` + the `/api/investments*` routes in `server.py`): a "position" is never stored directly — it's derived on every read by aggregating a customer's `investment_transactions` rows per ticker via `compute_positions()` (standard average-cost-basis method: BUY updates the running weighted average, SELL reduces shares without touching the average). Tickers with zero shares held are closed positions and excluded from `/api/investments`. "Closing a position" (`/api/investments/<ticker>/close`) inserts a full SELL transaction rather than deleting history, so past P&L stays intact. `stocks.py` wraps all `yfinance` calls (`get_quote`, `get_name`, `get_history`, `search_tickers`, `validate_ticker`, `timeframe_changes`) behind an in-memory TTL cache — new investment-related routes should go through this module rather than calling `yfinance` directly, both for caching and because it's where ticker validation lives (`add_investment_transaction` rejects unknown tickers via `stocks.validate_ticker`, mirroring the finance category-validation pattern). `build_portfolio_value_series(rows, start_date, history_period=None)` reconstructs a daily value trend from `start_date` to today by walking *every ticker that ever appears in `rows`* (not just currently-open ones) day-by-day against `yfinance` daily closes — a closed position still contributes its history up to the day it was sold, then correctly holds at $0 rather than the series vanishing once nothing is open. `start_date` is caller-computed via `_timeframe_start_date(timeframe, rows)`, which resolves `'all'` to the scope's actual earliest transaction date (not a fixed lookback) and every other timeframe to `today - N days`.

**Dividends** (`investment_dividends` + the dividend-related routes/helpers): a dividend payment is a standalone record, never a row in `investment_transactions` — `compute_positions()`/`compute_realized_pl()` replay every row there as BUY/SELL, so mixing a dividend type in would corrupt that math. `stocks.get_dividend_info(ticker)` returns `{annualRatePerShare, yieldOnPricePct}`, self-computing the yield from price rather than trusting yfinance's own yield fields (confirmed inconsistently scaled — sometimes a %, sometimes a decimal fraction — across different tickers). Recording a dividend (`POST /api/investments/dividends`) replays `investment_transactions` up to the given date through `compute_positions()` to determine shares held at payment time, and the frontend's "Record Dividend" modal pre-fills a suggested amount via `GET /api/investments/<ticker>/dividend-estimate` (a simple `annualRate / 4` quarterly estimate — yfinance doesn't reliably expose real payment frequency) which the user always confirms/edits before saving. Dividends are informational only — never linked to `accounts`/`finance_transactions`.

**Onboarding vs. account-wide stats:** `/api/investments/onboarding-status` (`hasHistory` bool, `EXISTS` check on `investment_transactions`) is what actually gates the first-run wizard in `InvestmentExpanded.js` — *not* whether current positions are empty. Selling everything down to $0 must not re-trigger onboarding; that's the whole reason this endpoint exists instead of just checking `investments.length === 0`. `/api/investments/stats` is the account-wide aggregate — `compute_realized_pl()` (sibling to `compute_positions()`, same chronological-replay approach) supplies realized P/L here. **This is also what the Dashboard's `InvestmentPortfolio` tile uses** (not the older `/api/investments/summary`, which only covers unrealized position aggregation and lacks realized P/L or dividend income).

### Frontend (`frontend/src`)

Routing is defined once in `index.js` (`react-router-dom`): `/` and `/Register` → `Register`, `/login` → `Login`, `/Dashboard` → `Dashboard`. There's no auth-guarded route wrapper — `Dashboard` and other components redirect to `/Login` themselves on a 401 response.

`Dashboard.js` is the top-level authenticated view. On mount it fetches `/api/finance/dashboard-summary` and `/api/investments/stats` (see note above on why not `/summary`). `/api/user-account-balance` still exists but is no longer called by the frontend. Both dashboard cards (`FinanceOverview`, `InvestmentPortfolio`) are backed by real data with Recharts sparklines and are clickable to expand into overlay detail views (`FinanceExpanded`, `InvestmentExpanded`).

`Components/InvestmentPortfolio/` mirrors the `FinanceOverview/` folder's structure and conventions:
- `InvestmentExpanded.js` fetches `/api/investments` and `onboarding-status` on mount. Shows `InvestmentSetupWizard` only when `!hasHistory`; otherwise always renders the normal sidebar + overview shell, even with zero current positions (they render fine empty). A "📊 Statistics" button in the header opens `StatisticsPanel.js`, an absolutely-positioned overlay (`.statistics-overlay`, needs `.expanded-container { position: relative }`) covering the sidebar+body area.
- `InvestmentsSidebar.js` lists open positions (price, day change, market value, P/L). `StockOverview.js` is the detail-panel component for a selected ticker.
- `InvestmentSetupWizard.js` (first-run only) lets a user add individual stocks, searching and allocating shares/amounts across 3 steps.
- Modals import `../FinanceOverview/Modal.css` for shared chrome rather than duplicating styles.

`Components/FinanceOverview/` is the multi-account detail view, opened as an overlay from the dashboard:
- `FinanceExpanded.js` owns the `accounts` list and `selectedAccountId` state, fetched from `/api/accounts`, and passes callbacks down.
- `AccountsSidebar.js` lists accounts, and handles add/delete account (via `AddAccountModal.js`), calling back up to `FinanceExpanded` to update local state.
- `OverviewContent.js` is the busiest component: given a `selectedAccountId`, it independently fetches transactions (`/api/transactions`) and chart data (`/api/finance/chart-data`, driven by a `timeframe` dropdown: `1d`/`1w`/`1m`/`3m`/`1y`/`ytd`/`all`), renders a Recharts line/bar chart, a transaction table with colored category badges, and opens `AddTransactionModal.js` to add new transactions. Adding/deleting a transaction triggers three refetches (transactions, chart data, and `refreshAccounts()` up to `FinanceExpanded`) to keep the sidebar balance in sync.
- `categories.js` exports `EXPENSE_CATEGORIES`/`INCOME_CATEGORIES` (mirroring `server.py`'s lists — see the backend section) and `getCategoryColor()`, used by `AddTransactionModal.js`'s category `<select>` (options swap based on the selected type) and `OverviewContent.js`'s category badges.

No global state management (no Redux/Context) — data flows via props and is refetched from the API after mutations rather than updated optimistically in local state.

All API calls use absolute URLs to `http://localhost:5000` (not relative paths, despite the `proxy` field in `package.json`) and always pass `credentials: 'include'` for session cookies. Keep this convention when adding new fetch calls.
