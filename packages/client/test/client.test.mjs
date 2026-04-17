import test from "node:test";
import assert from "node:assert/strict";

import { MarketMindApiError, MarketMindClient } from "../dist/index.js";

test("client injects bearer auth and normalizes base URL", async () => {
  const calls = [];
  const client = new MarketMindClient({
    apiKey: "mmpk_test.secret",
    baseUrl: "https://api.example.com/",
    fetch: async (input, init) => {
      calls.push({ input, init });
      return new Response(
        JSON.stringify({
          status: "ok",
          api: "marketmind-public",
          version: "v2",
          beta: true,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    },
  });

  const payload = await client.health.get();
  assert.equal(payload.version, "v2");
  assert.equal(String(calls[0].input), "https://api.example.com/api/public/v2/health");

  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("Authorization"), "Bearer mmpk_test.secret");
  assert.equal(headers.get("Accept"), "application/json");
});

test("client builds query strings for search and screener routes", async () => {
  const seenUrls = [];
  const client = new MarketMindClient({
    apiKey: "mmpk_test.secret",
    baseUrl: "https://api.example.com/api/public/v2",
    fetch: async (input) => {
      seenUrls.push(String(input));
      return new Response(
        JSON.stringify({
          query: "tencent",
          market: "all",
          matches: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    },
  });

  await client.assets.search("tencent", { market: "all" });
  await client.screener.scan({
    preset: "momentum_leaders",
    sector: "Technology",
    limit: 5,
    offset: 0,
  });

  assert.equal(seenUrls[0], "https://api.example.com/api/public/v2/search-symbols?q=tencent&market=all");
  assert.equal(
    seenUrls[1],
    "https://api.example.com/api/public/v2/screener/scan?preset=momentum_leaders&sector=Technology&limit=5&offset=0"
  );
});

test("client maps evaluation params to the bounded public route", async () => {
  let seenUrl = null;
  const client = new MarketMindClient({
    apiKey: "mmpk_test.secret",
    baseUrl: "https://api.example.com",
    fetch: async (input) => {
      seenUrl = String(input);
      return new Response(
        JSON.stringify({
          symbol: "AAPL",
          featureSpecVersion: "prediction-stack-v2",
          testPeriod: { startDate: "2026-02-01", endDate: "2026-04-01", days: 30 },
          bestModel: "ensemble",
          models: { ensemble: { metrics: { mae: 1 } } },
          returns: {},
          evaluationOptions: { testDays: 30, fastMode: false },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    },
  });

  const payload = await client.evaluations.get("AAPL", { testDays: 30, fastMode: false });
  assert.equal(payload.evaluationOptions.fastMode, false);
  assert.equal(
    seenUrl,
    "https://api.example.com/api/public/v2/evaluations/AAPL?test_days=30&fast_mode=false"
  );
});

test("client translates API errors into MarketMindApiError", async () => {
  const client = new MarketMindClient({
    apiKey: "mmpk_test.secret",
    baseUrl: "https://api.example.com",
    fetch: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "invalid_api_key",
            message: "Missing Authorization Bearer token",
            request_id: "req_123",
          },
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "0",
            "x-request-id": "req_123",
          },
        }
      ),
  });

  await assert.rejects(
    () => client.health.get(),
    (error) => {
      assert.ok(error instanceof MarketMindApiError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "invalid_api_key");
      assert.equal(error.requestId, "req_123");
      assert.equal(error.headers.rateLimitRemaining, "0");
      return true;
    }
  );
});
