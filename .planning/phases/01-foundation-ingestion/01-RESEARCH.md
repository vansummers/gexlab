# Phase 01: Foundation & Ingestion - Research

## Data Acquisition (yfinance)
- **Mechanism**: `yfinance` requires fetching the list of expiries first (`ticker.options`), then iterating through each date to fetch the specific `option_chain(date)`.
- **Latency/Rate Limits**: Yahoo Finance has strict rate limits. Sequential requests with a 0.5s - 1.0s delay are recommended to prevent IP bans.
- **Contract Coverage**: ETFs like `SPY` have 50+ expiries. We should prioritize the next 3-5 expiries (including 0DTE/1DTE) for real-time calculation and fetch the outer ones less frequently if needed.
- **Futures Tickers**:
    - S&P 500 E-mini: `ES=F`
    - Nasdaq 100 E-mini: `NQ=F`

## Backend Architecture (FastAPI)
- **Async Pattern**: Use FastAPI's `BackgroundTasks` or a dedicated `asyncio` task loop to refresh the cache without blocking API responses.
- **In-Memory Cache**: A global dictionary `current_market_data` can store the most recent chains and calculated metrics for immediate retrieval by the frontend.
- **Structure**:
    - `main.py`: Entry point and routes.
    - `services/data_service.py`: Logic for fetching raw chains.
    - `services/basis_service.py`: Logic for Spot vs. Futures price mapping.

## Frontend Architecture (Next.js)
- **Setup**: Standard `npx create-next-app` with Tailwind.
- **Proxy**: Use a rewrite or a direct URL to the FastAPI backend (e.g., `http://localhost:8000`).
- **Live Updating**: Use `SWR` or `React Query` on the frontend for periodic polling of the backend API.

## Validation Architecture
- **Verification**: Cross-check Spot prices and Futures prices manually during initial testing to ensure the basis delta is correct.
- **Fail-safes**: Implement error handling for missing expiries or empty chains from yfinance.

---
*Date: 2026-04-12*
