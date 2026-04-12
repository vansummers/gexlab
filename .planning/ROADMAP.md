# Roadmap: GexLab v2

## Milestone 1: Core Engine & Data
*Objective: Build the backend capable of calculating GEX and Levels from raw data.*

### Phase 1: Foundation & Ingestion
- [ ] Initialize project structure (Backend: Python, Frontend: Next.js)
- [ ] Implement `yfinance` Data Provider for full options chains
- [ ] Create basic caching mechanism for chain data
- [ ] Implement basis calculation logic for ETF -> Futures conversion

### Phase 2: The Quant Machine
- [ ] Implement Black-Scholes Greek Engine (Delta, Gamma, Vega, Theta)
- [ ] Implement Higher-Order Greeks (Vanna, Charm)
- [ ] Build the GEX Aggregator (Per-strike and Net Exposure)
- [ ] Validate math results against institutional benchmarks

### Phase 3: Level Intelligence
- [ ] Implement Gamma Flip discovery (interpolation logic)
- [ ] Implement Call/Put Wall and Max Pain algorithms
- [ ] Implement Vanna Peak (Vol Trigger) and Skew levels
- [ ] Create the comprehensive "Morning Report" JSON generator

## Milestone 2: Dashboard & Bridge
*Objective: Visualize the data and enable TradingView integration.*

### Phase 4: Backend API
- [ ] Build FastAPI endpoints for `metrics`, `keyLevels`, and `agg`
- [ ] Implement real-time polling logic for intraday updates
- [ ] Add the "TV Payload" endpoint specifically for copy-paste strings

### Phase 5: Premium UI
- [ ] Setup Next.js with Tailwind and Framer Motion
- [ ] Build the "Metrics Dashboard" (Spot, Net Gex, Ratio)
- [ ] Implement the GEX-by-Strike chart (Horizontal Bar Chart)
- [ ] Build the "Key Levels" table with regime context

### Phase 6: Bridge & Polish
- [ ] Implement the "Copy to Clipboard" bridge for TradingView
- [ ] Final UI/UX polish (Aesthetics, Animations, Dark Mode)
- [ ] Comprehensive documentation on how to use with Pine Script
- [ ] Final Milestone Audit

## Future Backlog
- [ ] Intraday OI estimation based on Volume
- [ ] Historical level overlay in the dashboard
- [ ] Discord/Telegram bot notifications for wall touches
