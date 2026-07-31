"""yfinance wrapper with simple in-memory TTL caching.

yfinance is an unofficial Yahoo Finance client and can be rate-limited
(HTTP 429), so every call in here is cached briefly rather than hitting
Yahoo on every request. Requires `pip install yfinance` — not in any
requirements file since this repo has none (see CLAUDE.md).
"""
import time
import math
import yfinance as yf

QUOTE_TTL = 120       # 2 min — price/day-change data
NAME_TTL = 86400      # 1 day — company names rarely change
HISTORY_TTL = 300     # 5 min — historical OHLC series
SEARCH_TTL = 60       # 1 min — autocomplete results
DIVIDEND_TTL = 3600   # 1 hour — dividend rate/yield fields rarely change

_cache = {}


def _cached(key, ttl, fetch_fn):
    now = time.time()
    entry = _cache.get(key)
    if entry is not None and (now - entry[0]) < ttl:
        return entry[1]
    value = fetch_fn()
    _cache[key] = (now, value)
    return value


def get_quote(ticker):
    """{price, previousClose, dayChangePct, dayChangeAbs} or None if invalid."""
    def fetch():
        try:
            fi = yf.Ticker(ticker).fast_info
            price = fi.last_price
            prev_close = fi.previous_close
            if price is None or prev_close is None:
                return None
            change_abs = price - prev_close
            change_pct = (change_abs / prev_close * 100) if prev_close else 0.0
            return {
                'price': float(price),
                'previousClose': float(prev_close),
                'dayChangePct': float(change_pct),
                'dayChangeAbs': float(change_abs),
            }
        except Exception:
            return None
    return _cached(f'quote:{ticker}', QUOTE_TTL, fetch)


def get_name(ticker):
    def fetch():
        try:
            info = yf.Ticker(ticker).info
            return info.get('shortName') or info.get('longName') or ticker
        except Exception:
            return ticker
    return _cached(f'name:{ticker}', NAME_TTL, fetch)


def get_history(ticker, period):
    """List of {date, close} dicts, oldest first. Empty list if invalid ticker."""
    def fetch():
        try:
            hist = yf.Ticker(ticker).history(period=period)
            if hist is None or hist.empty:
                return []
            rows = []
            for idx, row in hist.iterrows():
                close = row.get('Close')
                if close is None or (isinstance(close, float) and math.isnan(close)):
                    continue
                rows.append({'date': idx.date().isoformat(), 'close': float(close)})
            return rows
        except Exception:
            return []
    return _cached(f'history:{ticker}:{period}', HISTORY_TTL, fetch)


def search_tickers(query):
    """List of {symbol, name, exchange} for autocomplete."""
    def fetch():
        try:
            results = yf.Search(query, max_results=10).quotes
            return [
                {
                    'symbol': r.get('symbol'),
                    'name': r.get('shortname') or r.get('longname') or r.get('symbol'),
                    'exchange': r.get('exchDisp') or r.get('exchange'),
                }
                for r in results
                if r.get('quoteType') in ('EQUITY', 'ETF', 'MUTUALFUND') and r.get('symbol')
            ]
        except Exception:
            return []
    return _cached(f'search:{query.lower()}', SEARCH_TTL, fetch)


def validate_ticker(ticker):
    return get_quote(ticker) is not None


def get_dividend_info(ticker):
    """{annualRatePerShare, yieldOnPricePct} or None if the ticker doesn't pay
    a dividend / data is unavailable. Prefers trailingAnnualDividendRate (the
    actual trailing-12mo total) falling back to dividendRate (a forward
    estimate; some ETFs lack the trailing field). yieldOnPricePct is
    self-computed from that rate and the current price rather than trusting
    yfinance's own dividendYield/trailingAnnualDividendYield fields, which
    come back inconsistently scaled (sometimes a %, sometimes a fraction)
    across different tickers."""
    def fetch():
        try:
            info = yf.Ticker(ticker).info
            rate = info.get('trailingAnnualDividendRate') or info.get('dividendRate')
            if not rate or rate <= 0:
                return None
            quote = get_quote(ticker)
            price = quote['price'] if quote else None
            yield_pct = (rate / price * 100) if price else 0.0
            return {'annualRatePerShare': float(rate), 'yieldOnPricePct': float(yield_pct)}
        except Exception:
            return None
    return _cached(f'dividend:{ticker}', DIVIDEND_TTL, fetch)


TIMEFRAME_DAYS = {
    '1d': 1,
    '1w': 7,
    '1m': 30,
    '3m': 90,
    '1y': 365,
}


def timeframe_changes(history_rows):
    """Given oldest-first {date, close} rows (ideally ~1y+), compute % change
    for each standard timeframe vs the latest close. 'ytd' compares to the
    first close on/after Jan 1 of the current year."""
    if not history_rows:
        return {}

    latest_close = history_rows[-1]['close']
    latest_date = history_rows[-1]['date']
    result = {}

    for label, days in TIMEFRAME_DAYS.items():
        cutoff = _days_before(latest_date, days)
        base_row = next((r for r in history_rows if r['date'] >= cutoff), history_rows[0])
        result[label] = _pct_change(base_row['close'], latest_close)

    year = latest_date[:4]
    ytd_start = f'{year}-01-01'
    ytd_row = next((r for r in history_rows if r['date'] >= ytd_start), history_rows[0])
    result['ytd'] = _pct_change(ytd_row['close'], latest_close)

    result['all'] = _pct_change(history_rows[0]['close'], latest_close)

    return result


def _days_before(iso_date, days):
    from datetime import date, timedelta
    y, m, d = (int(p) for p in iso_date.split('-'))
    return (date(y, m, d) - timedelta(days=days)).isoformat()


def _pct_change(base, latest):
    if not base:
        return 0.0
    return float((latest - base) / base * 100)
