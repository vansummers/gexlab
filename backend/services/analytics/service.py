import numpy as np
import pandas as pd
import yfinance as yf
import logging
from datetime import datetime
from typing import Dict, Any, List
from .engine import GreeksEngine

logger = logging.getLogger("analytics_service")

class GexAnalyticsService:
    def __init__(self):
        self.engine = GreeksEngine()

    def get_risk_free_rate(self) -> float:
        """Fetch current 13-week Treasury Bill yield (^IRX)."""
        try:
            irx = yf.Ticker("^IRX")
            rate = irx.fast_info['lastPrice'] / 100.0 # Convert 4.5 to 0.045
            return rate if rate > 0 else 0.045
        except:
            return 0.045 # Default to 4.5% if fetch fails

    def process_chain(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process raw options chain data into exposure metrics.
        """
        df_raw = pd.DataFrame(raw_data.get("data", []))
        if df_raw.empty:
            return {}

        spot = raw_data.get("spotPrice", 0.0)
        r = self.get_risk_free_rate()
        q = 0.015 # Default dividend yield for SPY
        
        # Prepare inputs for engine
        S = np.full(len(df_raw), spot)
        K = df_raw['strike'].values
        
        # Calculate Time to Expiration (T) in years
        now = datetime.now()
        df_raw['expiry_dt'] = pd.to_datetime(df_raw['expiry'])
        T = (df_raw['expiry_dt'] - now).dt.total_seconds() / (365 * 24 * 3600)
        T = np.maximum(T, 1e-5) # Prevent division by zero for expired contracts
        
        # Implied Volatility (use provided IV or interpolate)
        sigma = df_raw['impliedVolatility'].values
        sigma = np.maximum(sigma, 0.01) # Floor IV at 1%
        
        flags = df_raw['type'].map({'call': 'c', 'put': 'p'}).values

        # 1. Calculate Standard Greeks
        # Since vectorized_black_scholes expects flags as a string or uniform array, 
        # we split it or use the underlying vectorized calls
        # For simplicity, we'll calculate all as calls and all as puts then mask
        greeks_c = self.engine.calculate_basic_greeks(S, K, T, r, sigma, "c")
        greeks_p = self.engine.calculate_basic_greeks(S, K, T, r, sigma, "p")
        
        # Masking by type
        is_call = (flags == 'c')
        delta = np.where(is_call, greeks_c['delta'], greeks_p['delta'])
        gamma = np.where(is_call, greeks_c['gamma'], greeks_p['gamma'])
        vega = np.where(is_call, greeks_c['vega'], greeks_p['vega'])
        theta = np.where(is_call, greeks_c['theta'], greeks_p['theta'])
        
        # 2. Calculate Higher Order Greeks
        higher = self.engine.calculate_higher_order_greeks(S, K, T, r, q, sigma)
        
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

        # Store results back to DF
        df_raw['delta'] = delta
        df_raw['gamma'] = gamma
        df_raw['vega'] = vega
        df_raw['theta'] = theta
        df_raw['vanna'] = higher['vanna']
        df_raw['charm'] = higher['charm']
        
        # Aggregation by Strike
        agg = df_raw.groupby('strike').agg({
            'gex': 'sum',
            'dex': 'sum',
            'vex': 'sum',
            'chex': 'sum',
            'openInterest': 'sum',
            'volume': 'sum'
        }).reset_index()
        
        # Metrics summary
        total_gex = df_raw['gex'].sum()
        total_dex = df_raw['dex'].sum()
        
        return {
            "summary": {
                "totalNetGex": total_gex,
                "totalNetDex": total_dex,
                "spotPrice": spot,
                "riskFreeRate": r,
                "timestamp": datetime.now().isoformat()
            },
            "strikes": agg.to_dict(orient="records")
        }
