// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// The heavy full-page suites (SearchPage, FundamentalsPage, ScreenerPage,
// PredictionMarketsPage) do real async rendering — framer-motion animations
// plus fetch-driven state — which can exceed the default 1s `waitFor` and 5s
// per-test timeouts when jest runs many workers in parallel on a multi-core
// machine. Give async queries and tests extra headroom so parallel CPU
// contention doesn't produce spurious "Unable to find …" timeouts. A genuinely
// missing element still fails, just after a longer wait.
jest.setTimeout(15000);
configure({ asyncUtilTimeout: 5000 });
