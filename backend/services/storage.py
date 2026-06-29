import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


class SnapshotStorageService:
    def __init__(self, base_dir: Optional[Path] = None):
        project_root = Path(__file__).resolve().parents[2]
        self.base_dir = base_dir or project_root / "data" / "snapshots"
        self.base_dir.mkdir(parents=True, exist_ok=True)
        # In-memory cache for snapshot date lists; invalidated on save.
        self._dates_cache: Dict[str, List[str]] = {}

    def _ticker_dir(self, ticker: str) -> Path:
        ticker_dir = self.base_dir / ticker.upper()
        ticker_dir.mkdir(parents=True, exist_ok=True)
        return ticker_dir

    def _snapshot_path(self, ticker: str, snapshot_date: str) -> Path:
        return self._ticker_dir(ticker) / f"{snapshot_date}.json"

    def save_snapshot(
        self,
        ticker: str,
        raw_data: Dict[str, Any],
        basis_data: Dict[str, Any],
        analytics_data: Dict[str, Any],
        snapshot_date: Optional[str] = None,
        source: str = "auto",
    ) -> Path:
        saved_at = datetime.now(timezone.utc).isoformat()
        effective_date = snapshot_date or saved_at[:10]
        payload = {
            "ticker": ticker.upper(),
            "date": effective_date,
            "savedAt": saved_at,
            "source": source,
            "raw": self._make_json_safe(raw_data),
            "basis": self._make_json_safe(basis_data),
            "analytics": self._make_json_safe(analytics_data),
        }

        snapshot_path = self._snapshot_path(ticker, effective_date)
        snapshot_path.write_text(json.dumps(payload), encoding="utf-8")
        # Invalidate cached date list so the next API request reflects the new file.
        self._dates_cache.pop(ticker.upper(), None)
        return snapshot_path

    def list_snapshot_dates(self, ticker: str) -> List[str]:
        key = ticker.upper()
        if key not in self._dates_cache:
            ticker_dir = self._ticker_dir(key)
            dates = sorted(
                (path.stem for path in ticker_dir.glob("*.json")),
                reverse=True,
            )
            self._dates_cache[key] = dates
        return self._dates_cache[key]

    def load_snapshot(self, ticker: str, snapshot_date: str) -> Optional[Dict[str, Any]]:
        snapshot_path = self._snapshot_path(ticker, snapshot_date)
        if not snapshot_path.exists():
            return None
        return json.loads(snapshot_path.read_text(encoding="utf-8"))

    def snapshot_exists(self, ticker: str, snapshot_date: str) -> bool:
        return self._snapshot_path(ticker, snapshot_date).exists()

    def _make_json_safe(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {str(key): self._make_json_safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._make_json_safe(item) for item in value]
        if isinstance(value, tuple):
            return [self._make_json_safe(item) for item in value]
        if isinstance(value, (datetime, pd.Timestamp)):
            return value.isoformat()
        if value is pd.NaT:
            return None
        if isinstance(value, np.generic):
            return value.item()
        if isinstance(value, float) and np.isnan(value):
            return None
        return value
