import json
import unittest

from services.analytics.bridge import BridgeService


class BridgePayloadTests(unittest.TestCase):
    def test_generate_tv_payload_contains_near_dte_levels_in_futures_space(self) -> None:
        analytics = {
            "levels": {
                "byDte": [
                    {
                        "dte": 0,
                        "gammaFlip": 499.0,
                        "callWall": 509.0,
                        "putWall": 491.0,
                    },
                    {
                        "dte": 1,
                        "gammaFlip": 498.0,
                        "callWall": 512.0,
                        "putWall": 488.0,
                    },
                ],
            }
        }
        basis = {"etf_price": 500.0, "future_price": 20000.0, "basis": 0.0}

        payload = json.loads(BridgeService.generate_tv_payload(analytics, basis, "QQQ"))

        self.assertEqual(
            payload,
            {
                "d0cw": 20360.0,
                "d0pw": 19640.0,
                "d0vt": 19960.0,
                "d1cw": 20480.0,
                "d1pw": 19520.0,
                "d1vt": 19920.0,
            },
        )

    def test_generate_futures_levels_csv_converts_qqq_to_nq(self) -> None:
        analytics = {
            "levels": {
                "byDte": [
                    {"dte": 0, "gammaFlip": 499.0, "callWall": 509.0, "putWall": 491.0},
                    {"dte": 1, "gammaFlip": 498.0, "callWall": 512.0, "putWall": 488.0},
                ],
                "vanna": {"flip": 501.0, "callWall": 513.0, "putWall": 487.0},
                "charm": {"flip": 502.0, "callWall": 514.0, "putWall": 486.0},
            }
        }
        basis = {"etf_price": 500.0, "future_price": 20000.0, "basis": 0.0}

        self.assertEqual(
            BridgeService.generate_futures_levels_csv(analytics, basis, "QQQ"),
            "20360,19640,19960,20480,19520,19920,20040,20520,19480,20080,20560,19440,0,0,0,0,0,0,0,0,0,0",
        )

    def test_generate_futures_levels_csv_uses_front_two_unexpired_expiries(self) -> None:
        analytics = {
            "summary": {"timestamp": "2026-06-27T09:00:00-04:00"},
            "levels": {
                "byDte": [
                    {"expiry": "2026-06-26", "dte": 0, "gammaFlip": 490.0, "callWall": 500.0, "putWall": 480.0},
                    {"expiry": "2026-06-29", "dte": 2, "gammaFlip": 499.0, "callWall": 509.0, "putWall": 491.0},
                    {"expiry": "2026-06-30", "dte": 3, "gammaFlip": 498.0, "callWall": 512.0, "putWall": 488.0},
                ],
                "vanna": {},
                "charm": {},
            }
        }
        basis = {"etf_price": 500.0, "future_price": 20000.0, "basis": 0.0}

        self.assertEqual(
            BridgeService.generate_futures_levels_csv(analytics, basis, "QQQ"),
            "20360,19640,19960,20480,19520,19920,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0",
        )

    def test_generate_futures_levels_csv_converts_spy_to_es(self) -> None:
        analytics = {
            "levels": {
                "byDte": [
                    {"dte": 0, "gammaFlip": 499.0, "callWall": 509.0, "putWall": 491.0},
                    {"dte": 1, "gammaFlip": 498.0, "callWall": 512.0, "putWall": 488.0},
                ],
                "vanna": {"flip": 501.0, "callWall": 513.0, "putWall": 487.0},
                "charm": {"flip": 502.0, "callWall": 514.0, "putWall": 486.0},
            }
        }
        basis = {"etf_price": 500.0, "future_price": 5000.0, "basis": 0.0}

        self.assertEqual(
            BridgeService.generate_futures_levels_csv(analytics, basis, "SPY"),
            "5090,4910,4990,5120,4880,4980,5010,5130,4870,5020,5140,4860,0,0,0,0,0,0,0,0,0,0",
        )

    def test_generate_futures_levels_csv_appends_lambda_bands(self) -> None:
        analytics = {
            "levels": {
                "byDte": [
                    {"dte": 0, "gammaFlip": 499.0, "callWall": 509.0, "putWall": 491.0},
                    {"dte": 1, "gammaFlip": 498.0, "callWall": 512.0, "putWall": 488.0},
                ],
                "vanna": {},
                "charm": {},
                "lambda": {
                    "bands": {"up1": 505.0, "down1": 495.0, "up2": 510.0, "down2": 490.0}
                },
            }
        }
        basis = {"etf_price": 500.0, "future_price": 20000.0, "basis": 0.0}

        self.assertEqual(
            BridgeService.generate_futures_levels_csv(analytics, basis, "QQQ"),
            "20360,19640,19960,20480,19520,19920,0,0,0,0,0,0,20200,19800,20400,19600,0,0,0,0,0,0",
        )

    def test_generate_futures_levels_csv_appends_speed_and_zomma_levels(self) -> None:
        analytics = {
            "levels": {
                "byDte": [
                    {"dte": 0, "gammaFlip": 499.0, "callWall": 509.0, "putWall": 491.0},
                    {"dte": 1, "gammaFlip": 498.0, "callWall": 512.0, "putWall": 488.0},
                ],
                "vanna": {},
                "charm": {},
                "speed": {"flip": 503.0, "callWall": 515.0, "putWall": 485.0},
                "zomma": {"flip": 504.0, "callWall": 516.0, "putWall": 484.0},
            }
        }
        basis = {"etf_price": 500.0, "future_price": 20000.0, "basis": 0.0}

        self.assertEqual(
            BridgeService.generate_futures_levels_csv(analytics, basis, "QQQ"),
            "20360,19640,19960,20480,19520,19920,0,0,0,0,0,0,0,0,0,0,20120,20600,19400,20160,20640,19360",
        )

    def test_generate_greek_levels_csv_uses_zomma_walls(self) -> None:
        analytics = {
            "levels": {
                "vanna": {"flip": 1.0, "callWall": 2.0, "putWall": 3.0},
                "charm": {"flip": 4.0, "callWall": 5.0, "putWall": 6.0},
                "speed": {"flip": 7.0, "callWall": 8.0, "putWall": 9.0},
                "zomma": {"flip": 10.0, "callWall": 11.0, "putWall": 12.0},
                "vomma": {"flip": 13.0, "callWall": 14.0, "putWall": 15.0},
            }
        }

        self.assertEqual(
            BridgeService.generate_greek_levels_csv(analytics),
            "1.0,2.0,3.0,4.0,5.0,6.0,7.0,8.0,9.0,10.0,11.0,12.0",
        )


if __name__ == "__main__":
    unittest.main()
