import numpy as np
from scipy.stats import norm
import py_vollib_vectorized
from typing import Dict, Any

class GreeksEngine:
    @staticmethod
    def calculate_basic_greeks(S, K, T, r, sigma, flag):
        """
        Calculate standard Greeks (Delta, Gamma, Vega, Theta) using py_vollib_vectorized.
        """
        greeks = py_vollib_vectorized.vectorized_black_scholes(flag, S, K, T, r, sigma, return_as='dict')
        return greeks

    @staticmethod
    def calculate_higher_order_greeks(S, K, T, r, q, sigma):
        """
        Calculate higher-order Greeks (Vanna, Charm, Vomma) analytically.
        Inputs are numpy arrays.
        """
        # Calculate d1 and d2
        d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        
        # Probate density function N'(d1)
        pdf_d1 = norm.pdf(d1)
        
        # Vanna = dDelta / dVol
        # Vanna = -exp(-qT) * N'(d1) * d2 / sigma
        vanna = -np.exp(-q * T) * pdf_d1 * d2 / sigma
        
        # Charm = dDelta / dT
        # This is a simplified version, usually depends on Call/Put flag
        # For simplicity, we calculate the common core
        charm_core = (pdf_d1 * (d2 / (2 * T) - (r - q) / (sigma * np.sqrt(T))))
        
        # Vomma (Volga) = dVega / dVol
        # Vomma = Vega * d1 * d2 / sigma
        # Using analytical Vega = S * exp(-qT) * N'(d1) * sqrt(T)
        vega = S * np.exp(-q * T) * pdf_d1 * np.sqrt(T)
        vomma = vega * d1 * d2 / sigma
        
        return {
            "vanna": vanna,
            "charm": charm_core,
            "vomma": vomma,
            "vega_analytical": vega,
            "d1": d1,
            "d2": d2
        }

if __name__ == "__main__":
    # Test case
    S = np.array([450.0])
    K = np.array([450.0])
    T = np.array([1/365]) # 0DTE
    r = np.array([0.045])
    q = np.array([0.015])
    sigma = np.array([0.15])
    
    engine = GreeksEngine()
    basic = engine.calculate_basic_greeks(S, K, T, r, sigma, "c")
    higher = engine.calculate_higher_order_greeks(S, K, T, r, q, sigma)
    
    print(f"Delta: {basic['delta']}")
    print(f"Vanna: {higher['vanna']}")
    print(f"Charm: {higher['charm']}")
