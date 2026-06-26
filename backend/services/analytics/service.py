import numpy as np
import pandas as pd
import yfinance as yf
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from services.analytics.engine import GreeksEngine

logger = logging.getLogger("analytics_service")

_RFR_CACHE_TTL = timedelta(hours=1)

class GexAnalyticsService:
    def __init__(self):
        self.engine = GreeksEngine()
        self._rfr_cache: float | None = None
        self._rfr_fetched_at: datetime | None = None

    def get_risk_free_rate(self) -> float:
        """Fetch 13-week T-bill yield (^IRX), cached for 1 hour."""
        now = datetime.now()
        if (
            self._rfr_cache is not None
            and self._rfr_fetched_at is not None
            and now - self._rfr_fetched_at < _RFR_CACHE_TTL
        ):
            return self._rfr_cache
        try:
            irx = yf.Ticker("^IRX")
            rate = irx.fast_info['lastPrice'] / 100.0
            if rate > 0:
                self._rfr_cache = rate
                self._rfr_fetched_at = now
                return rate
        except Exception:
            pass
        return self._rfr_cache if self._rfr_cache is not None else 0.045

    def process_chain(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process raw options chain data into exposure metrics.
        """
        df_raw = pd.DataFrame(raw_data.get("data", []))
        if df_raw.empty:
            return None

        spot = raw_data.get("spotPrice", 0.0)
        r = self.get_risk_free_rate()
        # Approximate dividend yields: SPY ~1.5%, QQQ ~0.6%
        ticker = raw_data.get("symbol", "SPY").upper()
        q = 0.006 if ticker == "QQQ" else 0.015
        
        # Prepare inputs for engine
        S = np.full(len(df_raw), spot)
        K = df_raw['strike'].values
        
        # Calculate Time to Expiration (T) in years
        now = datetime.now()
        df_raw['expiry_dt'] = pd.to_datetime(df_raw['expiry'])
        T = (df_raw['expiry_dt'] - now).dt.total_seconds() / (365 * 24 * 3600)
        T = np.maximum(T, 1e-5) # Prevent division by zero for expired contracts
        
        # Implied Volatility — fill NaN with a neutral 20% default before flooring
        # so a single missing IV doesn't propagate NaN through all Greeks.
        sigma = df_raw['impliedVolatility'].fillna(0.2).values
        sigma = np.maximum(sigma, 0.01)
        
        flags = df_raw['type'].map({'call': 'c', 'put': 'p'}).values

        # 1. Calculate Standard Greeks
        greeks = self.engine.calculate_basic_greeks(S, K, T, r, sigma, flags)

        delta = greeks['delta']
        gamma = greeks['gamma']
        vega = greeks['vega']
        theta = greeks['theta']

        # Attribution mask for dealer positioning
        is_call = (flags == 'c')

        # 2. Calculate Higher Order Greeks — reuse d1/d2/sqrt_t already in greeks
        higher = self.engine.calculate_higher_order_greeks(S, K, T, r, q, sigma, _precomputed=greeks)
        
        # 3. Calculate Dealer Exposures (EX)
        # Exposure = Greek * OpenInterest * Multiplier * SpotPrice (for GEX)
        # Attribution: Dealers short Calls (Positive Gamma) / short Puts (Negative Gamma)
        # Note: In standard GEX models, Gamma(total) = (Call Gamma - Put Gamma) * OI * 100 * S^2 * 0.01
        
        oi = df_raw['openInterest'].fillna(0).values
        
        # GEX (Dollar Gamma per 1% move)
        # Formula: OI * Gamma * 100 * Spot * Spot * 0.01
        gex_all = oi * gamma * 100 * spot * spot * 0.01
        df_raw['gex'] = np.where(is_call, gex_all, -gex_all)
        
        # DEX (Dollar Delta)
        dex_all = oi * delta * 100 * spot
        df_raw['dex'] = np.where(is_call, dex_all, -dex_all)
        
        # Vanna Exposure (VEX)
        vex_all = oi * higher['vanna'] * 100 * spot
        df_raw['vex'] = np.where(is_call, vex_all, -vex_all)
        
        # Charm Exposure (CHEX)
        chex_all = oi * higher['charm'] * 100 * spot
        df_raw['chex'] = np.where(is_call, chex_all, -chex_all)

        df_raw['delta'] = delta
        df_raw['gamma'] = gamma
        df_raw['vega'] = vega
        df_raw['theta'] = theta
        df_raw['vanna'] = higher['vanna']
        df_raw['charm'] = higher['charm']
        df_raw['iv'] = sigma
        
        # Aggregation by Strike
        agg = df_raw.groupby('strike').agg({
            'gex': 'sum',
            'dex': 'sum',
            'vex': 'sum',
            'chex': 'sum',
            'openInterest': 'sum',
            'volume': 'sum',
            'iv': 'mean' # Skew visualization
        }).reset_index()
        
        # Metrics summary
        total_gex = df_raw['gex'].sum()
        total_dex = df_raw['dex'].sum()
        
        # Metadata for Surface
        # Group by Expiry then Strike to build matrix
        pivoted = df_raw.pivot_table(index='expiry', columns='strike', values='iv', aggfunc='mean').fillna(0)
        
        surface = {
            "expiries": pivoted.index.tolist(),
            "strikes": pivoted.columns.tolist(),
            "matrix": pivoted.values.tolist()
        }

        return {
            "summary": {
                "totalNetGex": total_gex,
                "totalNetDex": total_dex,
                "spotPrice": spot,
                "riskFreeRate": r,
                "timestamp": datetime.now().isoformat()
            },
            "strikes": agg.to_dict(orient="records"),
            "surface": surface,
            "raw": df_raw.to_dict(orient="records")
        }
