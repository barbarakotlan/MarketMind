from __future__ import annotations


def handle_notifications_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_notifications_fn,
    save_notifications_fn,
    jsonify_fn,
    yf_module,
    uuid_module,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    notifications = load_notifications_fn(user_id)

    if request_obj.method == 'POST':
        try:
            data = request_obj.get_json()
            if not data or 'ticker' not in data or 'condition' not in data or 'target_price' not in data:
                return jsonify_fn({"error": "Missing required fields (ticker, condition, target_price)"}), 400

            try:
                stock = yf_module.Ticker(data['ticker']).info
                if stock.get('regularMarketPrice') is None:
                    return jsonify_fn({"error": f"Invalid ticker: {data['ticker']}"}), 400
            except Exception:
                return jsonify_fn({"error": f"Invalid ticker: {data['ticker']}"}), 400

            new_alert = {
                "id": str(uuid_module.uuid4()),
                "ticker": data['ticker'].upper(),
                "condition": data['condition'],
                "target_price": float(data['target_price']),
                "created_at": datetime_cls.now().isoformat(),
            }
            notifications['active'].append(new_alert)
            save_notifications_fn(notifications, user_id)
            return jsonify_fn(new_alert), 201
        except Exception as exc:
            return jsonify_fn({"error": str(exc)}), 500

    return jsonify_fn(notifications.get('active', []))


def create_smart_alert_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_notifications_fn,
    save_notifications_fn,
    jsonify_fn,
    yf_module,
    uuid_module,
    datetime_cls,
    logger,
    re_module,
):
    try:
        user_id = get_current_user_id_fn()
        data = request_obj.json
        prompt = data.get('prompt', '').strip()

        ticker_map = {
            'apple': 'AAPL', 'tesla': 'TSLA', 'microsoft': 'MSFT',
            'nvidia': 'NVDA', 'amazon': 'AMZN', 'google': 'GOOGL',
            'bitcoin': 'BTC-USD', 'meta': 'META', 'netflix': 'NFLX',
            'ai': 'NVDA', 'artificial intelligence': 'NVDA',
            'sp500': '^GSPC', 'market': '^GSPC',
        }

        detected_ticker = None
        prompt_lower = prompt.lower()
        for name, symbol in ticker_map.items():
            if name in prompt_lower:
                detected_ticker = symbol
                break

        if not detected_ticker:
            stop_tickers = {
                'ME', 'MY', 'I', 'WE', 'US', 'THE', 'IS', 'AT', 'ON', 'IN', 'TO',
                'FOR', 'OF', 'BY', 'AN', 'UP', 'DO', 'GO', 'OR', 'IF', 'BE',
                'ARE', 'IT', 'AS', 'HI', 'LO', 'NEW', 'OLD', 'BIG', 'BUY', 'SELL',
                'ALERT', 'NOTIFY', 'TELL', 'SHOW', 'WHEN', 'WHAT', 'WHERE',
                'HOW', 'WHY', 'WHO', 'DROP', 'FALL', 'RISE', 'GAIN', 'TODAY',
                'NEWS', 'REPORT', 'DATA', 'INFO', 'THIS', 'THAT', 'THESE', 'THOSE',
            }
            words = re_module.findall(r'\b[A-Z]{1,5}\b', prompt)
            for word in words:
                if word not in stop_tickers:
                    detected_ticker = word
                    break

        if not detected_ticker:
            return jsonify_fn({
                'error': 'Could not identify a specific stock or asset. Try mentioning "Apple", "TSLA", or "Bitcoin".'
            }), 400

        alert_type = 'price'
        condition = 'above'
        target_price = 0.0

        if any(x in prompt_lower for x in ['news', 'earnings', 'report', 'releasing', 'announce', 'article', 'headline']):
            alert_type = 'news'
            condition = 'news_release'
            target_price = 0
        else:
            is_drop = any(x in prompt_lower for x in ['drop', 'fall', 'below', 'less', 'under', 'loss', 'down', 'crash'])
            condition = 'below' if is_drop else 'above'

            pct_match = re_module.search(r'(\d+(?:\.\d+)?)%', prompt)
            price_match = re_module.search(r'\$\s?(\d+(?:\.\d+)?)', prompt)
            number_match = re_module.search(r'\b(\d+(?:\.\d+)?)\b', prompt)

            current_price = 0.0
            try:
                ticker_obj = yf_module.Ticker(detected_ticker)
                current_price = ticker_obj.fast_info.get('last_price', 0)
                if current_price == 0:
                    current_price = ticker_obj.info.get('regularMarketPrice', 0)
            except Exception:
                pass

            if pct_match and current_price > 0:
                pct = float(pct_match.group(1))
                if is_drop:
                    target_price = current_price * (1 - (pct / 100))
                else:
                    target_price = current_price * (1 + (pct / 100))
            elif price_match:
                target_price = float(price_match.group(1))
            elif number_match:
                target_price = float(number_match.group(1))
            else:
                target_price = current_price * 0.99 if is_drop else current_price * 1.01

        notifications = load_notifications_fn(user_id)
        new_alert = {
            "id": str(uuid_module.uuid4()),
            "ticker": detected_ticker,
            "condition": condition,
            "target_price": target_price,
            "type": alert_type,
            "prompt": prompt,
            "active": True,
            "created_at": datetime_cls.now().isoformat(),
        }

        notifications['active'].append(new_alert)
        save_notifications_fn(notifications, user_id)

        return jsonify_fn({
            'message': 'Smart alert created successfully',
            'interpretation': f"Watching {detected_ticker} for {condition} events.",
            'alert': new_alert,
        })
    except Exception as exc:
        logger.error(f"Smart Alert Error: {exc}")
        return jsonify_fn({'error': str(exc)}), 500


def delete_notification_handler(
    alert_id,
    *,
    get_current_user_id_fn,
    load_notifications_fn,
    save_notifications_fn,
    jsonify_fn,
):
    user_id = get_current_user_id_fn()
    notifications = load_notifications_fn(user_id)
    notifications['active'] = [a for a in notifications['active'] if a['id'] != alert_id]
    save_notifications_fn(notifications, user_id)
    return jsonify_fn({"message": "Alert deleted"}), 200


def get_triggered_notifications_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_notifications_fn,
    save_notifications_fn,
    jsonify_fn,
):
    user_id = get_current_user_id_fn()
    notifications = load_notifications_fn(user_id)

    if request_obj.method == 'GET':
        if request_obj.args.get('all') == 'true':
            return jsonify_fn(notifications.get('triggered', []))

        unseen_alerts = [a for a in notifications['triggered'] if not a.get('seen', False)]
        for alert in notifications['triggered']:
            alert['seen'] = True
        save_notifications_fn(notifications, user_id)
        return jsonify_fn(unseen_alerts)

    if request_obj.args.get('id'):
        alert_id = request_obj.args.get('id')
        notifications['triggered'] = [a for a in notifications['triggered'] if a['id'] != alert_id]
    else:
        notifications['triggered'] = []
    save_notifications_fn(notifications, user_id)
    return jsonify_fn({"message": "Triggered alerts cleared"}), 200


def delete_triggered_notification_handler(
    alert_id,
    *,
    get_current_user_id_fn,
    load_notifications_fn,
    save_notifications_fn,
    jsonify_fn,
):
    user_id = get_current_user_id_fn()
    notifications = load_notifications_fn(user_id)
    notifications['triggered'] = [a for a in notifications['triggered'] if a['id'] != alert_id]
    save_notifications_fn(notifications, user_id)
    return jsonify_fn({"message": "Alert dismissed"}), 200
