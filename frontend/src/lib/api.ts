import type {
  AnalyticsResponse,
  BridgePayloadResponse,
  HealthResponse,
  HistoricalSnapshotResponse,
  MacroEventsResponse,
  RawMetricsResponse,
  SnapshotDatesResponse,
} from '../types/analytics';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://gexlab-production.up.railway.app';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new ApiError(res.status, `API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const fetchHealth = () => get<HealthResponse>('/api/health');
export const fetchAnalytics = (ticker: string) => get<AnalyticsResponse>(`/api/metrics/analytics/${ticker}`);
export const fetchBasisMetrics = () => get<RawMetricsResponse>('/api/metrics/raw');
export const fetchBridgePayload = (ticker: string) => get<BridgePayloadResponse>(`/api/metrics/bridge/${ticker}`);
export const fetchSnapshotDates = (ticker: string) => get<SnapshotDatesResponse>(`/api/history/${ticker}/dates`);
export const fetchHistoricalSnapshot = (ticker: string, date: string) =>
  get<HistoricalSnapshotResponse>(`/api/history/${ticker}/${date}`);
export const fetchMacroEvents = () => get<MacroEventsResponse>('/api/events/macro');
export interface CombinedBridgeResponse {
  spy: string;
  qqq: string;
  spy_greeks: string;
  qqq_greeks: string;
  es: string;
  nq: string;
  mnq: string;
  pine: string;
  timestamp: string | null;
}
export const fetchCombinedBridge = () => get<CombinedBridgeResponse>('/api/metrics/bridge');
