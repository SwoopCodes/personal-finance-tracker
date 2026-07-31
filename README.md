# Finance Tracker

A personal finance and investment tracking web app. Track bank accounts and income/expense transactions with category breakdowns and balance history charts, alongside a stock portfolio tracker with live pricing (via `yfinance`), unrealized/realized P&L, and dividend tracking.

Built as a Flask + PostgreSQL API (`backend/`) with a Create React App frontend (`frontend/`).

## Running with Docker

This is the recommended way to run the project — it builds the React frontend, serves it from Flask, and spins up Postgres with the schema already applied.

**Prerequisites:** Docker and Docker Compose.

**1. Set the session secret**

A `.env` file must exist at the project root (`program/.env`) with a `SECRET_KEY`, used to sign session cookies:

```bash
echo "SECRET_KEY=\"$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')\"" > .env
```

**2. Build and start everything**

From the `program/` directory:

```bash
docker compose up --build
```

This starts two containers:
- `db` — Postgres 13, database `finance_program`, schema loaded automatically from `init.sql` on first run, exposed on host port `5433`
- `web` — the Flask API, serving the production React build as static files, exposed on host port `5000`

**3. Open the app**

Go to **http://localhost:5000** — the frontend and API are both served from this single origin.

**Stopping / resetting**

```bash
docker compose down          # stop containers, keep the database volume
docker compose down -v       # stop containers and wipe the database volume
```

The Postgres data lives in a named volume (`postgres_data`), so your data survives `docker compose down` (without `-v`) and container rebuilds.
