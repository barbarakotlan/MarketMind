import { expect, test } from '@playwright/test';

const chartData = [
  { date: '2026-07-01', open: 200, high: 203, low: 198, close: 201 },
  { date: '2026-07-02', open: 201, high: 205, low: 200, close: 204 },
];

const portfolio = {
  cash: 10000,
  options_positions: [],
  options_value: 0,
  positions: [],
  positions_value: 0,
  starting_value: 10000,
  total_pl: 0,
  total_return: 0,
  total_value: 10000,
};

const history = {
  dates: ['2026-07-01', '2026-07-02'],
  values: [10000, 10000],
  summary: {
    period: 'ytd',
    start_date: '2026-07-01',
    end_date: '2026-07-02',
    end_value: 10000,
    wealth_generated: 0,
    return_cumulative_pct: 0,
    return_annualized_pct: 0,
  },
};

async function mockBackend(page) {
  const calls = [];

  await page.route('http://localhost:5001/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    calls.push({
      authorization: request.headers().authorization,
      method,
      pathname: url.pathname,
      postData: request.postDataJSON?.(),
    });

    const fulfill = (json) => route.fulfill({ json, status: 200 });

    if (url.pathname === '/notifications/triggered') return fulfill([]);
    if (url.pathname === '/marketmind-ai/chats') return fulfill([]);
    if (url.pathname === '/screener') {
      return fulfill({
        active: [],
        gainers: [{ symbol: 'AAPL', name: 'Apple Inc.', percent_change: 1.2, volume: 1000 }],
        losers: [],
      });
    }
    if (url.pathname === '/stock/AAPL') {
      return fulfill({
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        price: 204,
        change: 3,
        changePercent: 1.49,
        marketCap: '3.1T',
        fundamentals: { overview: 'Consumer technology company.', recommendationKey: 'buy' },
        financials: {},
      });
    }
    if (url.pathname === '/chart/AAPL') return fulfill(chartData);
    if (url.pathname === '/predict/ensemble/AAPL') {
      return fulfill({
        predictions: [
          { date: '2026-07-03', predictedClose: 205 },
          { date: '2026-07-06', predictedClose: 206 },
          { date: '2026-07-07', predictedClose: 207 },
        ],
      });
    }
    if (url.pathname === '/news') return fulfill([]);
    if (url.pathname === '/search-symbols') return fulfill([]);
    if (url.pathname === '/paper/portfolio' && method === 'GET') return fulfill(portfolio);
    if (url.pathname === '/paper/history') return fulfill(history);
    if (url.pathname === '/paper/buy' && method === 'POST') {
      return fulfill({ message: 'Bought 1 share of AAPL.' });
    }
    if (url.pathname === '/paper/portfolio/optimize') {
      return fulfill({ allocations: [], diagnostics: {}, method: 'mean_variance' });
    }

    return fulfill({});
  });

  return calls;
}

test('local sign-in, navigation, stock search, and paper buy journey', async ({ page }) => {
  const calls = await mockBackend(page);

  await page.goto('/search');

  await expect(page.getByLabel('Local development user')).toBeVisible();
  await expect(page).toHaveURL(/\/search$/);

  await page.getByPlaceholder('e.g., AAPL, HK:00700, CN:600519').fill('AAPL');
  await page.getByRole('main').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('Apple Inc.', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('$204.00')).toBeVisible();

  await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByRole('heading', { name: 'Paper Trading' })).toBeVisible();

  await page.getByRole('button', { name: 'Buy Asset' }).click();
  await page.getByPlaceholder('e.g. AAPL').fill('AAPL');
  await page.getByPlaceholder('10').fill('1');
  await page.getByRole('button', { name: 'Submit Buy' }).click();
  await expect(page.getByText('Bought 1 share of AAPL.')).toBeVisible();

  expect(calls.some((call) => call.authorization === 'Bearer marketmind-local-development')).toBe(true);
  expect(calls).toContainEqual(expect.objectContaining({
    method: 'POST',
    pathname: '/paper/buy',
    postData: { ticker: 'AAPL', shares: 1 },
  }));
});
