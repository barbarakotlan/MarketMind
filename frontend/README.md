# MarketMind Frontend

The frontend is a React 19 application built with Vite 8. It uses Clerk for
hosted authentication, a development-only local auth mode, Vitest for unit and
component tests, and Playwright for critical browser journeys.

## Requirements

- Node.js 24 or newer (see `.nvmrc`)
- npm
- A running MarketMind backend at `VITE_API_URL`

## Local Setup

```bash
npm ci
cp .env.example .env
npm start
```

The development server listens on [http://localhost:3000](http://localhost:3000).
For a self-contained local session, configure the matching local auth values in
the root backend environment and this frontend environment.

## Commands

- `npm start` starts Vite on port 3000.
- `npm run build` creates the production bundle in `dist/`.
- `npm run lint` runs ESLint 9.
- `npm test` runs Vitest once.
- `npm run test:coverage` runs Vitest with enforced coverage floors.
- `npm run test:e2e` runs the Playwright browser suite.
- `bash run_frontend_checks.sh` runs the required lint, unit, coverage, and
  production-build checks.

## Environment

```dotenv
VITE_API_URL=http://localhost:5001
VITE_AUTH_MODE=local
VITE_LOCAL_AUTH_USER_ID=local_development_user
VITE_LOCAL_AUTH_TOKEN=marketmind-local-development
```

For a hosted environment, set `VITE_AUTH_MODE=clerk` and provide
`VITE_CLERK_PUBLISHABLE_KEY`. Never put backend secrets in a Vite variable;
every `VITE_*` value is visible to the browser.
