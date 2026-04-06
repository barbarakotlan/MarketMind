from __future__ import annotations


def check_alerts_for_user(
    user_id,
    *,
    load_notifications_fn,
    save_notifications_fn,
    yf_module,
    logger,
    uuid_module,
    datetime_cls,
):
    notifications_data = load_notifications_fn(user_id)
    if not notifications_data["active"]:
        return

    active_alerts_copy = notifications_data["active"].copy()
    tickers_to_check = list(set([alert["ticker"] for alert in active_alerts_copy]))

    try:
        data = yf_module.download(tickers_to_check, period="1d")
        if data.empty:
            logger.warning("Price check: yfinance returned no data.")
            return

        current_prices = data["Close"].iloc[-1]
        triggered_ids = []

        for alert in active_alerts_copy:
            try:
                if alert.get("type") == "news":
                    try:
                        ticker_obj = yf_module.Ticker(alert["ticker"])
                        news_items = ticker_obj.news
                        if news_items:
                            latest_news = news_items[0]
                            pub_time = latest_news.get("providerPublishTime")
                            if pub_time:
                                pub_dt = datetime_cls.fromtimestamp(pub_time)
                                if (datetime_cls.now() - pub_dt).total_seconds() < 86400:
                                    triggered_alert = {
                                        "id": str(uuid_module.uuid4()),
                                        "message": f"NEWS: {latest_news.get('title')} ({alert['ticker']})",
                                        "seen": False,
                                        "timestamp": datetime_cls.now().isoformat(),
                                    }
                                    notifications_data["triggered"].append(triggered_alert)
                                    triggered_ids.append(alert["id"])
                    except Exception as news_err:
                        logger.error("News check error: %s", news_err)
                    continue

                if len(tickers_to_check) == 1:
                    current_price = float(current_prices)
                else:
                    current_price = float(current_prices.get(alert["ticker"], 0))

                if current_price == 0:
                    continue

                target_price = alert["target_price"]
                condition_met = False
                message = ""

                if alert["condition"] == "below" and current_price < target_price:
                    condition_met = True
                    message = (
                        f"{alert['ticker']} is now ${current_price:.2f} "
                        f"(below your target of ${target_price:.2f})"
                    )
                elif alert["condition"] == "above" and current_price > target_price:
                    condition_met = True
                    message = (
                        f"{alert['ticker']} is now ${current_price:.2f} "
                        f"(above your target of ${target_price:.2f})"
                    )

                if condition_met:
                    logger.info("Triggering alert for %s", alert["ticker"])
                    triggered_alert = {
                        "id": str(uuid_module.uuid4()),
                        "message": message,
                        "seen": False,
                        "timestamp": datetime_cls.now().isoformat(),
                    }
                    notifications_data["triggered"].append(triggered_alert)
                    triggered_ids.append(alert["id"])
            except Exception as exc:
                logger.error("Error checking alert for %s: %s", alert["ticker"], exc)

        if triggered_ids:
            notifications_data["active"] = [
                alert for alert in notifications_data["active"] if alert["id"] not in triggered_ids
            ]
            save_notifications_fn(notifications_data, user_id)
            logger.info("Triggered and moved %s alerts.", len(triggered_ids))
    except Exception as exc:
        logger.error("Failed to check all alert prices: %s", exc)


def check_alerts(*, iter_user_ids_fn, check_alerts_for_user_fn, logger):
    logger.info("Running price alert check...")
    for user_id in iter_user_ids_fn():
        try:
            check_alerts_for_user_fn(user_id)
        except Exception as exc:
            logger.error("Alert check failed for user %s: %s", user_id, exc)


def run_scheduler(*, schedule_module, check_alerts_fn, time_module):
    schedule_module.every(1).minutes.do(check_alerts_fn)
    while True:
        schedule_module.run_pending()
        time_module.sleep(1)
