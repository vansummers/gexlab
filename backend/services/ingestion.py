import httpx
import pandas as pd
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ingestion")

_CBOE_BASE = "https://cdn.cboe.com/api/global/delayed_quotes/options/{symbol}.json"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; gexlab/1.0)",
    "Accept": "application/json",
}


def _parse_option_symbol(symbol: str, ticker: str) -> Optional[Dict[str, Any]]:
    """
    Parse a CBOE OCC option symbol into components.
    Format: {TICKER}{YYMMDD}{C|P}{strike*1000 zero-padded to 8 digits}
    Example: SPY260626C00425000 -> expiry=2026-06-26, type=call, strike=425.0
    """
    rest = symbol[len(ticker):]
    if len(rest) < 15:
        return None
    try:
        expiry = datetime.strptime(rest[:6], "%y%m%d").strftime("%Y-%m-%d")
        option_type = "call" if rest[6].upper() == "C" else "put"
        strike = int(rest[7:]) / 1000.0
        return {"expiry": expiry, "type": option_type, "strike": strike}
    except (ValueError, IndexError):
        return None


class GexIngestionService:
    def __init__(self, ticker_symbol: str = "SPY"):
        self.ticker_symbol = ticker_symbol.upper()
        self.cache: Dict[str, Any] = {}
        self.last_fetch_time: Optional[datetime] = None
        self.cache_expiry_seconds = 60

    def _fetch_cboe(self) -> Dict[str, Any]:
        url = _CBOE_BASE.format(symbol=self.ticker_symbol)
        with httpx.Client(timeout=30, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.json()

    def fetch_full_chain(self, expiries_to_fetch: int = 5) -> Dict[str, Any]:
        """
        Fetch options chain from CBOE for the next N expiries.
        Implements basic caching.
        """
        now = datetime.now()

        if self.last_fetch_time and (now - self.last_fetch_time).total_seconds() < self.cache_expiry_seconds:
            logger.info("Returning cached options chain data")
            return self.cache

        try:
            payload = self._fetch_cboe()
        except Exception as e:
            logger.error(f"CBOE fetch failed for {self.ticker_symbol}: {e}")
            return {}

        cboe_data = payload.get("data", {})
        spot_price = cboe_data.get("current_price") or cboe_data.get("close") or 0.0
        options_raw: List[Dict] = cboe_data.get("options", [])

        if not options_raw:
            logger.warning(f"No options returned from CBOE for {self.ticker_symbol}")
            return {}

        # Parse all options and find the N earliest expiries
        parsed = []
        for o in options_raw:
            sym = o.get("option", "")
            parts = _parse_option_symbol(sym, self.ticker_symbol)
            if not parts:
                continue
            parsed.append({**parts, **o})

        all_expiries = sorted({r["expiry"] for r in parsed})
        selected_expiries = set(all_expiries[:expiries_to_fetch])
        logger.info(f"Fetching chains for {self.ticker_symbol}: {sorted(selected_expiries)}")

        rows = []
        for r in parsed:
            if r["expiry"] not in selected_expiries:
                continue
            rows.append({
                "contractSymbol": r.get("option", ""),
                "strike": r["strike"],
                "type": r["type"],
                "expiry": r["expiry"],
                "bid": r.get("bid"),
                "ask": r.get("ask"),
                "lastPrice": r.get("last_trade_price"),
                "volume": r.get("volume"),
                "openInterest": r.get("open_interest"),
                "impliedVolatility": r.get("iv"),
                "delta": r.get("delta"),
                "gamma": r.get("gamma"),
                "theta": r.get("theta"),
                "vega": r.get("vega"),
            })

        if not rows:
            logger.warning(f"No rows after filtering expiries for {self.ticker_symbol}")
            return {}

        df = pd.DataFrame(rows)

        result = {
            "symbol": self.ticker_symbol,
            "spotPrice": float(spot_price),
            "timestamp": now.isoformat(),
            "data": df.to_dict(orient="records"),
        }

        self.cache = result
        self.last_fetch_time = now
        logger.info(f"Ingestion complete for {self.ticker_symbol}. Total rows: {len(df)}")

        return result

    def get_spot_price(self) -> float:
        """Fetch the current spot price from CBOE."""
        try:
            payload = self._fetch_cboe()
            d = payload.get("data", {})
            price = d.get("current_price") or d.get("close")
            return float(price) if price else 0.0
        except Exception as e:
            logger.error(f"Error fetching price for {self.ticker_symbol}: {e}")
            return 0.0


if __name__ == "__main__":
    service = GexIngestionService("SPY")
    data = service.fetch_full_chain(expiries_to_fetch=2)
    print(f"Fetched {len(data.get('data', []))} contracts for {data.get('symbol')}")
    print(f"Current Spot: {data.get('spotPrice')}")
