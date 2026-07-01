import unittest

from services.analytics.levels import LevelIntelligenceService, LEVEL_BAND_PCT


def _strike(strike, gex=0.0, vex=0.0):
    # Minimal aggregated-strike row with the columns _summarize_levels touches.
    return {
        "strike": strike, "gex": gex, "vex": vex,
        "dex": 0.0, "lex": 0.0, "chex": 0.0, "spex": 0.0,
        "zomex": 0.0, "vomex": 0.0, "openInterest": 1000, "volume": 100, "iv": 0.2,
    }


class LevelBandTests(unittest.TestCase):
    def test_far_otm_outliers_excluded_from_walls_and_magnet(self):
        spot = 748.55
        agg = [
            _strike(740.0, gex=-5e8, vex=2e6),
            _strike(745.0, gex=-2e8, vex=3e6),
            _strike(749.0, gex=6e8,  vex=4e6),
            _strike(800.0, gex=1e8,  vex=9e9),   # far-OTM vanna spike (~+6.9%)
            _strike(670.0, gex=-9e9, vex=1e6),   # far-OTM put spike (~-10%)
        ]

        lv = LevelIntelligenceService._summarize_levels(agg, [], spot)

        # Outliers at 800 / 670 are outside +/-4% and must be excluded.
        self.assertEqual(lv["callWall"], 749.0)
        self.assertEqual(lv["putWall"], 740.0)
        self.assertEqual(lv["vannaMagnet"], 749.0)
        self.assertLessEqual(lv["sessionCeiling"], spot * (1 + LEVEL_BAND_PCT))

    def test_band_falls_back_when_nothing_in_range(self):
        # All strikes are far from spot: the band would empty the frame, so it
        # must fall back to the full set rather than returning nothing.
        spot = 748.55
        agg = [_strike(600.0, gex=-1e9, vex=1e6), _strike(900.0, gex=1e9, vex=2e6)]

        lv = LevelIntelligenceService._summarize_levels(agg, [], spot)

        self.assertIn(lv["callWall"], (600.0, 900.0))
        self.assertIsNotNone(lv["putWall"])


if __name__ == "__main__":
    unittest.main()
