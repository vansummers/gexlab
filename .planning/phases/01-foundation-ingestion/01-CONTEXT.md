# Phase 01: Foundation & Ingestion - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary
This phase delivers the core infrastructure: the local folder structure (monorepo), the FastAPI backend skeleton, the Next.js frontend skeleton, and the `yfinance` data ingestion service with dynamic basis calculation for Futures.

</domain>

<decisions>
## Implementation Decisions

### Project Organization
- **D-01: Monorepo Structure**: The project will use a divided root structure: `backend/` for Python/FastAPI and `frontend/` for Next.js.
- **D-02: Environment Management**: Use `venv` for Python and `npm` for Node.js.

### Backend Architecture
- **D-03: FastAPI Framework**: Selected for its async performance and automatic OpenAPI documentation.
- **D-04: Data Ingestion (yfinance)**: Implement a background service that polls `yfinance` for full options chains.
- **D-05: Real-time Polling**: Target a 15-30 second refresh rate during market hours.
- **D-06: Local Cache**: Use an in-memory or file-based cache to store the latest raw chain data.

### Futures Basis Logic
- **D-07: Dynamic Spread Detection**: The engine will fetch both the ETF price (e.g., SPY) and the corresponding Future price (e.g., ES=F) to calculate the live basis offset.

### the agent's Discretion
- Selection of specific Python dependencies (e.g., `requests` vs `httpx`).
- Frontend folder structure (standard Next.js App Router conventions).
- Internal data schema for the options chain JSON.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Standards
- `.planning/PROJECT.md` — Overall vision and GEX formulas.
- `.planning/REQUIREMENTS.md` — Functional specs for ingestion and mapping.

### Technical References
- `https://pypi.org/project/yfinance/` — Official yfinance documentation.
- `https://fastapi.tiangolo.com/` — FastAPI documentation.

</canonical_refs>

<specifics>
## Specific Ideas
- Ensure the backend exposes a health check endpoint.
- The frontend should have a basic "Status" indicator showing when the last data refresh occurred.

</specifics>

<deferred>
## Deferred Ideas
- Persistent historical database (Phase 4+).
- Advanced whale trade filtering (Milestone 2).

</deferred>

---

*Phase: 01-foundation-ingestion*
*Context gathered: 2026-04-12 via Discussion*
