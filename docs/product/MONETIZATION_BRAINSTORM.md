##  Free Tier (User Acquisition)
Goal: Hook users & SEO growth

Give away:

Basic stock search

Limited predictions (e.g., 3 per day)

Watchlist (limited to 5 stocks)

Paper trading with delays

Basic charts

News feed

Restrict:

Full backtesting metrics

Unlimited predictions

Advanced analytics

alerts & signals

## Pro Tier ($10/month)


Unlimited AI predictions

Ensemble model access (RF + XGB + LR) 

Full backtesting dashboard 

Portfolio analytics & Sharpe ratio tracking

Larger watchlists

Faster API rate limits

## Implementation
User signs up via Clerk

Clicks “Upgrade to Pro”

Redirect to Stripe Checkout

Stripe webhook updates user.subscription_tier in Postgres

Backend middleware gates premium endpoints

## Other thoughts

Maybe ads sometime in the future?

Student tier for the subscription?

Possible premium tier ($20-30) where we sell access to our backend endpoints so other developers can query Marketmind directly