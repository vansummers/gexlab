import type { AnalyticsResponse, BasisData } from '../types/analytics';

export type PriceMode = 'etf' | 'futures';

export function convertAnalyticsForDisplay(
  analytics: AnalyticsResponse | null,
  ticker: string,
  basis: BasisData | null,
  priceMode: PriceMode
): AnalyticsResponse | null {
  if (!analytics) return null;
  if (priceMode === 'etf' || !basis) return analytics;

  const offset = basis.basis;
  return {
    ...analytics,
    summary: {
      ...analytics.summary,
      spotPrice: analytics.summary.spotPrice + offset,
    },
    strikes: analytics.strikes.map((s) => ({ ...s, strike: s.strike + offset })),
    levels: analytics.levels
      ? {
          ...analytics.levels,
          gammaFlip: analytics.levels.gammaFlip != null ? analytics.levels.gammaFlip + offset : undefined,
          callWall: analytics.levels.callWall != null ? analytics.levels.callWall + offset : undefined,
          putWall: analytics.levels.putWall != null ? analytics.levels.putWall + offset : undefined,
          sessionCeiling: analytics.levels.sessionCeiling != null ? analytics.levels.sessionCeiling + offset : undefined,
          maxPain: analytics.levels.maxPain != null ? analytics.levels.maxPain + offset : undefined,
          vannaMagnet: analytics.levels.vannaMagnet != null ? analytics.levels.vannaMagnet + offset : undefined,
        }
      : undefined,
  };
}

export function convertBridgePayload(
  payload: string,
  ticker: string,
  basis: BasisData | null,
  priceMode: PriceMode
): string {
  if (priceMode === 'etf' || !basis) return payload;
  try {
    const data = JSON.parse(payload) as Record<string, unknown>;
    const offset = basis.basis;
    const shifted = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, typeof v === 'number' ? v + offset : v])
    );
    return JSON.stringify(shifted);
  } catch {
    return payload;
  }
}
