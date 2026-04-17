import type { components, paths } from "./generated/openapi";

export type { components, paths } from "./generated/openapi";

type FetchLike = typeof fetch;
type QueryValue = string | number | boolean | null | undefined;
type JsonRecord = Record<string, unknown>;

export type HealthResponse = components["schemas"]["HealthResponse"];
export type SearchSymbolsResponse = components["schemas"]["SearchSymbolsV2Response"];
export type StockResponse = components["schemas"]["StockResponseV2"];
export type ChartResponse = components["schemas"]["ChartResponseV2"];
export type FundamentalsResponse = components["schemas"]["FundamentalsResponseV2"];
export type MacroOverviewResponse = components["schemas"]["MacroOverviewResponseV2"];
export type PredictionEnsembleResponse = components["schemas"]["PredictionEnsembleResponseV2"];
export type EvaluationSummaryResponse = components["schemas"]["EvaluationSummaryResponseV2"];
export type ScreenerPresetCatalogResponse = components["schemas"]["ScreenerPresetCatalogResponseV2"];
export type ScreenerScanResponse = components["schemas"]["ScreenerScanResponseV2"];
export type PublicErrorEnvelope = components["schemas"]["PublicErrorEnvelope"];

export interface OptionsStockPriceResponse {
  ticker: string;
  price: number;
}

export interface OptionsExpirationsResponse {
  ticker: string;
  expirations: string[];
}

export interface OptionsChainResponse {
  ticker: string;
  expiration: string | null;
  stock_price: number;
  calls: Array<Record<string, unknown>>;
  puts: Array<Record<string, unknown>>;
}

export type OptionsSuggestionResponse = Record<string, unknown>;

export interface ForexConvertResponse {
  from: string;
  to: string;
  rate: number;
  [key: string]: unknown;
}

export interface ForexCurrenciesResponse {
  currencies: Array<Record<string, unknown>>;
}

export interface CryptoConvertResponse {
  from: string;
  to: string;
  rate: number;
  [key: string]: unknown;
}

export interface CryptoListResponse {
  assets: Array<Record<string, unknown>>;
}

export interface CryptoCurrenciesResponse {
  currencies: Array<Record<string, unknown>>;
}

export interface CommodityPriceResponse {
  commodity: string;
  period: string;
  points: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CommoditiesListResponse {
  commodities: Array<Record<string, unknown>>;
}

export interface CommoditiesAllResponse {
  categories: Record<string, Array<Record<string, unknown>>>;
}

export interface PredictionMarketsListResponse {
  markets: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface PredictionMarketsExchangesResponse {
  exchanges: Array<Record<string, unknown>>;
}

export type PredictionMarketDetailResponse = Record<string, unknown>;

export interface EconomicCalendarResponse {
  events: Array<Record<string, unknown>>;
}

export interface MarketMindClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  userAgent?: string;
}

export interface RequestHeadersSnapshot {
  rateLimitLimit?: string | null;
  rateLimitRemaining?: string | null;
  rateLimitReset?: string | null;
  dailyQuota?: string | null;
  dailyRemaining?: string | null;
  cache?: string | null;
  requestId?: string | null;
}

export class MarketMindApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly headers: RequestHeadersSnapshot;

  constructor({
    status,
    code,
    message,
    requestId,
    headers,
  }: {
    status: number;
    code: string;
    message: string;
    requestId: string | null;
    headers: RequestHeadersSnapshot;
  }) {
    super(message);
    this.name = "MarketMindApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.headers = headers;
  }
}

interface RequestConfig {
  query?: Record<string, QueryValue>;
}

const DEFAULT_BASE_URL = "https://api.marketmind.example.com";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function resolveApiBase(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl || DEFAULT_BASE_URL);
  if (normalized.endsWith("/api/public/v2")) {
    return normalized;
  }
  return `${normalized}/api/public/v2`;
}

function encodeQuery(query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function requestHeadersSnapshot(headers: Headers): RequestHeadersSnapshot {
  return {
    rateLimitLimit: headers.get("X-RateLimit-Limit"),
    rateLimitRemaining: headers.get("X-RateLimit-Remaining"),
    rateLimitReset: headers.get("X-RateLimit-Reset"),
    dailyQuota: headers.get("X-Public-API-Daily-Quota"),
    dailyRemaining: headers.get("X-Public-API-Daily-Remaining"),
    cache: headers.get("X-Cache"),
    requestId: headers.get("X-Request-ID"),
  };
}

function extractErrorEnvelope(payload: unknown): { code: string; message: string; requestId: string | null } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const error = (payload as PublicErrorEnvelope).error;
  if (!error || typeof error !== "object") {
    return null;
  }
  const code = typeof error.code === "string" ? error.code : "unknown_error";
  const message = typeof error.message === "string" ? error.message : "Request failed.";
  const requestId = typeof error.request_id === "string" ? error.request_id : null;
  return { code, message, requestId };
}

function createAbortSignal(timeoutMs: number | undefined): { signal?: AbortSignal; cleanup: () => void } {
  if (!timeoutMs || timeoutMs <= 0 || typeof AbortController === "undefined") {
    return { signal: undefined, cleanup: () => undefined };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

export class MarketMindClient {
  readonly health: {
    get: () => Promise<HealthResponse>;
  };

  readonly assets: {
    search: (query: string, options?: { market?: "us" | "hk" | "cn" | "all" }) => Promise<SearchSymbolsResponse>;
    get: (ticker: string, options?: { market?: "us" | "hk" | "cn" }) => Promise<StockResponse>;
    chart: (ticker: string, options?: { market?: "us" | "hk" | "cn"; period?: "1d" | "5d" | "14d" | "1mo" | "6mo" | "1y" }) => Promise<ChartResponse>;
    fundamentals: (ticker: string, options?: { market?: "us" | "hk" | "cn" }) => Promise<FundamentalsResponse>;
  };

  readonly predictions: {
    getEnsemble: (ticker: string) => Promise<PredictionEnsembleResponse>;
  };

  readonly evaluations: {
    get: (ticker: string, options?: { testDays?: number; fastMode?: boolean }) => Promise<EvaluationSummaryResponse>;
  };

  readonly screener: {
    getPresets: () => Promise<ScreenerPresetCatalogResponse>;
    scan: (options?: {
      preset?: string;
      query?: string;
      priceMin?: number;
      priceMax?: number;
      marketCapMin?: number;
      avgDollarVolumeMin?: number;
      sector?: string;
      sort?: string;
      dir?: "asc" | "desc";
      limit?: number;
      offset?: number;
    }) => Promise<ScreenerScanResponse>;
  };

  readonly macro: {
    getOverview: (options?: { region?: "us" | "asia" }) => Promise<MacroOverviewResponse>;
  };

  readonly options: {
    getStockPrice: (ticker: string) => Promise<OptionsStockPriceResponse>;
    getExpirations: (ticker: string) => Promise<OptionsExpirationsResponse>;
    getChain: (ticker: string, options?: { date?: string }) => Promise<OptionsChainResponse>;
    getSuggestion: (ticker: string) => Promise<OptionsSuggestionResponse>;
  };

  readonly forex: {
    convert: (options?: { from?: string; to?: string }) => Promise<ForexConvertResponse>;
    currencies: () => Promise<ForexCurrenciesResponse>;
  };

  readonly crypto: {
    convert: (options?: { from?: string; to?: string }) => Promise<CryptoConvertResponse>;
    list: () => Promise<CryptoListResponse>;
    currencies: () => Promise<CryptoCurrenciesResponse>;
  };

  readonly commodities: {
    price: (commodity: string, options?: { period?: string }) => Promise<CommodityPriceResponse>;
    list: () => Promise<CommoditiesListResponse>;
    all: () => Promise<CommoditiesAllResponse>;
  };

  readonly predictionMarkets: {
    list: (options?: { exchange?: string; limit?: number; search?: string }) => Promise<PredictionMarketsListResponse>;
    exchanges: () => Promise<PredictionMarketsExchangesResponse>;
    get: (marketId: string, options?: { exchange?: string }) => Promise<PredictionMarketDetailResponse>;
  };

  readonly calendar: {
    economic: () => Promise<EconomicCalendarResponse>;
  };

  private readonly apiKey: string;
  private readonly apiBase: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs?: number;
  private readonly userAgent?: string;

  constructor(options: MarketMindClientOptions) {
    if (!options || typeof options.apiKey !== "string" || !options.apiKey.trim()) {
      throw new TypeError("MarketMindClient requires a non-empty apiKey string.");
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new TypeError("MarketMindClient requires a fetch implementation.");
    }

    this.apiKey = options.apiKey.trim();
    this.apiBase = resolveApiBase(options.baseUrl || DEFAULT_BASE_URL);
    this.fetchImpl = fetchImpl;
    this.timeoutMs = options.timeoutMs;
    this.userAgent = options.userAgent;

    this.health = {
      get: () => this.request<HealthResponse>("/health"),
    };

    this.assets = {
      search: (query, options) =>
        this.request<SearchSymbolsResponse>("/search-symbols", {
          query: {
            q: query,
            market: options?.market,
          },
        }),
      get: (ticker, options) =>
        this.request<StockResponse>(`/stock/${encodeURIComponent(ticker)}`, {
          query: { market: options?.market },
        }),
      chart: (ticker, options) =>
        this.request<ChartResponse>(`/chart/${encodeURIComponent(ticker)}`, {
          query: {
            market: options?.market,
            period: options?.period,
          },
        }),
      fundamentals: (ticker, options) =>
        this.request<FundamentalsResponse>(`/fundamentals/${encodeURIComponent(ticker)}`, {
          query: { market: options?.market },
        }),
    };

    this.predictions = {
      getEnsemble: (ticker) => this.request<PredictionEnsembleResponse>(`/predictions/ensemble/${encodeURIComponent(ticker)}`),
    };

    this.evaluations = {
      get: (ticker, options) =>
        this.request<EvaluationSummaryResponse>(`/evaluations/${encodeURIComponent(ticker)}`, {
          query: {
            test_days: options?.testDays,
            fast_mode: options?.fastMode,
          },
        }),
    };

    this.screener = {
      getPresets: () => this.request<ScreenerPresetCatalogResponse>("/screener/presets"),
      scan: (options) =>
        this.request<ScreenerScanResponse>("/screener/scan", {
          query: {
            preset: options?.preset,
            query: options?.query,
            price_min: options?.priceMin,
            price_max: options?.priceMax,
            market_cap_min: options?.marketCapMin,
            avg_dollar_volume_min: options?.avgDollarVolumeMin,
            sector: options?.sector,
            sort: options?.sort,
            dir: options?.dir,
            limit: options?.limit,
            offset: options?.offset,
          },
        }),
    };

    this.macro = {
      getOverview: (options) =>
        this.request<MacroOverviewResponse>("/macro/overview", {
          query: { region: options?.region },
        }),
    };

    this.options = {
      getStockPrice: (ticker) =>
        this.request<OptionsStockPriceResponse>(`/options/stock-price/${encodeURIComponent(ticker)}`),
      getExpirations: (ticker) =>
        this.request<OptionsExpirationsResponse>(`/options/expirations/${encodeURIComponent(ticker)}`),
      getChain: (ticker, options) =>
        this.request<OptionsChainResponse>(`/options/chain/${encodeURIComponent(ticker)}`, {
          query: { date: options?.date },
        }),
      getSuggestion: (ticker) =>
        this.request<OptionsSuggestionResponse>(`/options/suggest/${encodeURIComponent(ticker)}`),
    };

    this.forex = {
      convert: (options) =>
        this.request<ForexConvertResponse>("/forex/convert", {
          query: { from: options?.from, to: options?.to },
        }),
      currencies: () => this.request<ForexCurrenciesResponse>("/forex/currencies"),
    };

    this.crypto = {
      convert: (options) =>
        this.request<CryptoConvertResponse>("/crypto/convert", {
          query: { from: options?.from, to: options?.to },
        }),
      list: () => this.request<CryptoListResponse>("/crypto/list"),
      currencies: () => this.request<CryptoCurrenciesResponse>("/crypto/currencies"),
    };

    this.commodities = {
      price: (commodity, options) =>
        this.request<CommodityPriceResponse>(`/commodities/price/${encodeURIComponent(commodity)}`, {
          query: { period: options?.period },
        }),
      list: () => this.request<CommoditiesListResponse>("/commodities/list"),
      all: () => this.request<CommoditiesAllResponse>("/commodities/all"),
    };

    this.predictionMarkets = {
      list: (options) =>
        this.request<PredictionMarketsListResponse>("/prediction-markets", {
          query: {
            exchange: options?.exchange,
            limit: options?.limit,
            search: options?.search,
          },
        }),
      exchanges: () => this.request<PredictionMarketsExchangesResponse>("/prediction-markets/exchanges"),
      get: (marketId, options) =>
        this.request<PredictionMarketDetailResponse>(`/prediction-markets/${encodeURIComponent(marketId)}`, {
          query: { exchange: options?.exchange },
        }),
    };

    this.calendar = {
      economic: () => this.request<EconomicCalendarResponse>("/calendar/economic"),
    };
  }

  private async request<T>(path: string, config: RequestConfig = {}): Promise<T> {
    const url = `${this.apiBase}${path}${encodeQuery(config.query)}`;
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    });

    if (this.userAgent) {
      headers.set("X-MarketMind-Client-User-Agent", this.userAgent);
      try {
        headers.set("User-Agent", this.userAgent);
      } catch {
        // Browsers may reject setting User-Agent. The custom header still carries the label.
      }
    }

    const { signal, cleanup } = createAbortSignal(this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers,
        signal,
      });

      const responseHeaders = requestHeadersSnapshot(response.headers);
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as unknown)
        : ((await response.text()) as unknown);

      if (!response.ok) {
        const errorEnvelope = extractErrorEnvelope(payload);
        throw new MarketMindApiError({
          status: response.status,
          code: errorEnvelope?.code || `http_${response.status}`,
          message:
            errorEnvelope?.message ||
            (typeof payload === "string" && payload.trim() ? payload : `Request failed with status ${response.status}.`),
          requestId: errorEnvelope?.requestId || responseHeaders.requestId || null,
          headers: responseHeaders,
        });
      }

      return payload as T;
    } finally {
      cleanup();
    }
  }
}

export default MarketMindClient;
