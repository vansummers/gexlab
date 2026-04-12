# Requirements: GexLab v2

## User Stories
As a futures trader, I want to see where market makers are forced to hedge so that I can identify high-probability support/resistance levels (Walls) and volatility regimes (Gamma Flip). I also need to easily copy these levels into my TradingView chart for accurate real-time trading of ES/NQ.

## Functional Requirements

### 1. Data Ingestion & Management
- [ ] Connect to `yfinance` to fetch full options chains for SPY, QQQ, and IWM.
- [ ] Implement a caching layer (Redis or local JSON) to store data for 60s to avoid rate limits.
- [ ] Synchronize Spot price for ETFs and corresponding Futures (ES/NQ) for basis calculation.

### 2. Options Math Engine
- [ ] Calculate standard Greeks: Delta, Gamma, Vega, Theta (BSM model).
- [ ] Calculate Higher-Order Greeks: Vanna, Charm, Vomma, Zomma.
- [ ] Aggregate GEX per strike across all expiries (AggGex).
- [ ] Calculate "Zero Gamma" strike (Gamma Flip) using strike-by-strike interpolation.
- [ ] Identify Call Wall (Max Call GEX) and Put Wall (Min Put GEX).
- [ ] Calculate "Max Pain" strike for Friday expiries.

### 3. Level Mapping & Conversion
- [ ] Calculate the "Basis" (Future Price - ETF Price * 10).
- [ ] Map ETF Levels to Futures Price with 1 tick resolution.
- [ ] Generate "Session Ceilings" and "Protected Gamma" levels based on DTE clustering.

### 4. Interactive UI
- [ ] Create a "Metrics" dashboard with live Spot, Net GEX, and GEX Ratio.
- [ ] Interactive GEX-by-Strike chart.
- [ ] "Key Levels" table with descriptions and "Regime Interpretation".
- [ ] "Copy Payload" button that copies a Pine Script-ready JSON string.

### 5. TradingView Bridge
- [ ] Standardized JSON structure implementation (Metrics, keyLevels, majorWalls, agg, raw).
- [ ] Ensure accurate price conversion for Futures tickers.

## Non-Functional Requirements
- **Performance**: Full GEX calculation for an index chain (500+ contracts) should take < 2 seconds.
- **Accuracy**: Greeks must be validated against institutional benchmarks (e.g., CBOE or IBKR).
- **UX**: Premium dark-mode aesthetic with "vibrant/premium" color palette.
- **Portability**: Must run via a single command on a local Windows machine.

## Out of Scope
- [ ] Fully automated TradingView execution (requires OAuth/Pro).
- [ ] Real-time OI estimation (too complex for MVP).
- [ ] History backtesting database (Phase 1 focus is live/morning data).
