# `@marketmind/client`

Typed JavaScript/TypeScript client for the MarketMind Public API v2.

This package is a thin wrapper around the read-only developer API at `/api/public/v2`.

## Install

```bash
npm install @marketmind/client
```

## Usage

```ts
import { MarketMindClient } from "@marketmind/client";

const client = new MarketMindClient({
  apiKey: process.env.MARKETMIND_API_KEY!,
  baseUrl: "https://api.marketmind.example.com",
});

const quote = await client.assets.get("AAPL");
const prediction = await client.predictions.getEnsemble("AAPL");
const screener = await client.screener.scan({
  preset: "momentum_leaders",
  sector: "Technology",
  limit: 10,
});
```

## Constructor

```ts
new MarketMindClient({
  apiKey,
  baseUrl,
  fetch,
  timeoutMs,
  userAgent,
});
```

- `apiKey`: required MarketMind developer API key.
- `baseUrl`: API origin or full `/api/public/v2` base. Defaults to `https://api.marketmind.example.com`.
- `fetch`: optional custom fetch implementation for Node or test environments.
- `timeoutMs`: optional request timeout in milliseconds.
- `userAgent`: optional client label sent as `X-MarketMind-Client-User-Agent` and, when possible, `User-Agent`.

## Available modules

- `client.health.get()`
- `client.assets.search(query, { market })`
- `client.assets.get(symbol, { market })`
- `client.assets.chart(symbol, { market, period })`
- `client.assets.fundamentals(symbol, { market })`
- `client.predictions.getEnsemble(symbol)`
- `client.evaluations.get(symbol, { testDays, fastMode })`
- `client.screener.getPresets()`
- `client.screener.scan({ preset, query, priceMin, priceMax, marketCapMin, avgDollarVolumeMin, sector, sort, dir, limit, offset })`
- `client.macro.getOverview({ region })`
- `client.options.getStockPrice(symbol)`
- `client.options.getExpirations(symbol)`
- `client.options.getChain(symbol, { date })`
- `client.options.getSuggestion(symbol)`
- `client.forex.convert({ from, to })`
- `client.forex.currencies()`
- `client.crypto.convert({ from, to })`
- `client.crypto.list()`
- `client.crypto.currencies()`
- `client.commodities.price(symbol, { period })`
- `client.commodities.list()`
- `client.commodities.all()`
- `client.predictionMarkets.list({ exchange, limit, search })`
- `client.predictionMarkets.exchanges()`
- `client.predictionMarkets.get(id, { exchange })`
- `client.calendar.economic()`

## Errors

Non-2xx responses throw `MarketMindApiError` with:

- `status`
- `code`
- `message`
- `requestId`
- `headers`

## Type generation

The package generates API types directly from [`/Users/tazeemmahashin/MarketMind/backend/public_api_openapi_v2.yaml`](/Users/tazeemmahashin/MarketMind/backend/public_api_openapi_v2.yaml):

```bash
npm run generate:types
```
