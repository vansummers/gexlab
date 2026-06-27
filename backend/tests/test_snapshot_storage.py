import unittest
from datetime import datetime
from pathlib import Path
import shutil
import tempfile
import pandas as pd

from main import get_eod_snapshot_date, should_save_eod_snapshot
from models import SnapshotResponse
from services.storage import SnapshotStorageService


class SnapshotStorageTests(unittest.TestCase):
    def test_save_list_and_load_snapshot(self) -> None:
        tmp_dir = Path(__file__).resolve().parent / "_tmp_snapshots"
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)

        try:
            service = SnapshotStorageService(base_dir=tmp_dir)
            service.save_snapshot(
                ticker="SPY",
                raw_data={
                    "timestamp": "2026-04-12T16:00:00",
                    "data": [
                        {
                            "strike": 500.0,
                            "lastTradeDate": pd.Timestamp("2026-04-12T15:59:59"),
                        }
                    ],
                },
                basis_data={"basis": 12.5, "future_price": 5123.0, "etf_price": 511.0},
                analytics_data={"summary": {"spotPrice": 511.0}, "strikes": [], "surface": {"expiries": [], "strikes": [], "matrix": []}, "raw": []},
                snapshot_date="2026-04-12",
            )

            dates = service.list_snapshot_dates("SPY")
            self.assertEqual(dates, ["2026-04-12"])

            loaded = service.load_snapshot("SPY", "2026-04-12")
            assert loaded is not None
            self.assertEqual(loaded["ticker"], "SPY")
            self.assertEqual(loaded["date"], "2026-04-12")
            self.assertIn("analytics", loaded)
            self.assertEqual(loaded["raw"]["data"][0]["lastTradeDate"], "2026-04-12T15:59:59")
        finally:
            if tmp_dir.exists():
                shutil.rmtree(tmp_dir)

    def test_eod_snapshot_gate_uses_post_close_et_trading_date(self) -> None:
        before_close = datetime.fromisoformat("2026-06-26T15:59:00-04:00")
        after_close = datetime.fromisoformat("2026-06-26T16:05:00-04:00")
        saturday = datetime.fromisoformat("2026-06-27T00:15:00-04:00")

        self.assertIsNone(get_eod_snapshot_date(before_close))
        self.assertEqual(get_eod_snapshot_date(after_close), "2026-06-26")
        self.assertIsNone(get_eod_snapshot_date(saturday))

    def test_eod_snapshot_gate_freezes_after_first_late_save(self) -> None:
        late_friday = datetime.fromisoformat("2026-06-26T21:00:00-04:00")

        with tempfile.TemporaryDirectory() as tmp:
            service = SnapshotStorageService(base_dir=Path(tmp))

            self.assertTrue(
                should_save_eod_snapshot(
                    "SPY",
                    "2026-06-26",
                    now=late_friday,
                    snapshot_store=service,
                )
            )

            service.save_snapshot(
                ticker="SPY",
                raw_data={"timestamp": "2026-06-26T21:00:00-04:00", "data": []},
                basis_data={},
                analytics_data={},
                snapshot_date="2026-06-26",
                source="eod",
            )

            self.assertFalse(
                should_save_eod_snapshot(
                    "SPY",
                    "2026-06-26",
                    now=late_friday,
                    snapshot_store=service,
                )
            )

    def test_snapshot_response_preserves_greek_levels(self) -> None:
        payload = {
            "ticker": "QQQ",
            "date": "2026-06-26",
            "savedAt": "2026-06-26T16:05:00-04:00",
            "source": "eod",
            "raw": {},
            "basis": {},
            "analytics": {
                "summary": {
                    "totalNetGex": 1.0,
                    "totalNetDex": 1.0,
                    "spotPrice": 500.0,
                    "riskFreeRate": 0.04,
                    "timestamp": "2026-06-26T16:05:00-04:00",
                },
                "strikes": [],
                "surface": {"expiries": [], "strikes": [], "matrix": []},
                "raw": [],
                "levels": {
                    "gammaFlip": 500.0,
                    "callWall": 510.0,
                    "putWall": 490.0,
                    "maxPain": 500.0,
                    "vannaMagnet": 501.0,
                    "vanna": {"flip": 502.0, "callWall": 515.0, "putWall": 485.0},
                    "charm": {"flip": 503.0, "callWall": 516.0, "putWall": 484.0},
                    "byDte": [],
                },
            },
        }

        response = SnapshotResponse(**payload)

        assert response.analytics.levels is not None
        assert response.analytics.levels.vanna is not None
        assert response.analytics.levels.charm is not None
        self.assertEqual(response.analytics.levels.vanna.callWall, 515.0)
        self.assertEqual(response.analytics.levels.charm.putWall, 484.0)


if __name__ == "__main__":
    unittest.main()
