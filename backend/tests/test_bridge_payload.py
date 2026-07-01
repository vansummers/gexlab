import json
import unittest

from services.analytics.bridge import BridgeService


class BridgePayloadTests(unittest.TestCase):
    def test_generate_tv_payload_emits_etf_space_multi_dte_levels(self) -> None:
        # The GexLab Levels indicator is plotted on the ETF chart, so the payload
        # stays in ETF price space. Packs cover 0/1/7/14/30/45 DTE, each matched
        # to the nearest available expiry; tiers with no expiry come out null.
        analytics = {
            "levels": {
                "byDte": [
                    {"dte": 0,  "gammaFlip": 499.0, "callWall": 509.0, "putWall": 491.0},
                    {"dte": 1,  "gammaFlip": 498.0, "callWall": 512.0, "putWall": 488.0},
                    {"dte": 8,  "gammaFlip": 497.0, "callWall": 520.0, "putWall": 480.0},
                    {"dte": 31, "gammaFlip": 495.0, "callWall": 540.0, "putWall": 460.0},
                ],
            }
        }

        payload = json.loads(BridgeService.generate_tv_payload(analytics, {}, "QQQ"))

        self.assertEqual(
            payload,
            {
                "d0cw": 509.0,  "d0pw": 491.0,  "d0vt": 499.0,
                "d1cw": 512.0,  "d1pw": 488.0,  "d1vt": 498.0,
                "d7cw": 520.0,  "d7pw": 480.0,  "d7vt": 497.0,   # dte 8 → nearest to 7
                "d14cw": None,  "d14pw": None,  "d14vt": None,   # no expiry within tolerance
                "d30cw": 540.0, "d30pw": 460.0, "d30vt": 495.0,  # dte 31 → nearest to 30
                "d45cw": None,  "d45pw": None,  "d45vt": None,
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
