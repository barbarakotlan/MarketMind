from __future__ import annotations


def list_prediction_markets_handler(
    *,
    request_obj,
    pm_search_markets_fn,
    pm_fetch_markets_fn,
    jsonify_fn,
    log_api_error_fn,
    logger,
):
    try:
        exchange = request_obj.args.get('exchange', 'polymarket')
        limit = request_obj.args.get('limit', 50, type=int)
        search = request_obj.args.get('search', '').strip()

        if limit < 1 or limit > 200:
            return jsonify_fn({"error": "Limit must be between 1 and 200"}), 400

        if search:
            markets = pm_search_markets_fn(search, exchange, limit)
        else:
            markets = pm_fetch_markets_fn(exchange, limit)

        return jsonify_fn({
            "exchange": exchange,
            "count": len(markets),
            "markets": markets,
        })
    except Exception as exc:
        log_api_error_fn(logger, '/prediction-markets', exc)
        return jsonify_fn({"error": f"Failed to fetch prediction markets: {str(exc)}"}), 500


def list_prediction_exchanges_handler(*, pm_get_exchanges_fn, jsonify_fn):
    return jsonify_fn(pm_get_exchanges_fn())


def get_prediction_market_handler(
    market_id,
    *,
    request_obj,
    pm_get_market_fn,
    jsonify_fn,
    log_api_error_fn,
    logger,
):
    try:
        exchange = request_obj.args.get('exchange', 'polymarket')
        market = pm_get_market_fn(market_id, exchange)
        if not market:
            return jsonify_fn({"error": "Market not found"}), 404
        return jsonify_fn(market)
    except Exception as exc:
        log_api_error_fn(logger, f'/prediction-markets/{market_id}', exc)
        return jsonify_fn({"error": "Failed to fetch market details"}), 500


def get_prediction_portfolio_handler(
    *,
    get_current_user_id_fn,
    load_prediction_portfolio_fn,
    pm_get_prices_fn,
    jsonify_fn,
    log_api_error_fn,
    logger,
):
    try:
        user_id = get_current_user_id_fn()
        portfolio = load_prediction_portfolio_fn(user_id)
        positions = portfolio.get("positions", {})
        positions_list = []
        total_positions_value = 0

        for pos_key, pos in positions.items():
            market_id = pos.get("market_id", "")
            outcome = pos.get("outcome", "")
            exchange = pos.get("exchange", "polymarket")
            contracts = pos["contracts"]
            avg_cost = pos["avg_cost"]
            question = pos.get("question", "Unknown Market")

            current_price = avg_cost
            prices = pm_get_prices_fn(market_id, exchange)
            if prices and outcome in prices:
                current_price = prices[outcome]

            current_value = contracts * current_price
            cost_basis = contracts * avg_cost
            total_pl = current_value - cost_basis
            total_pl_percent = (total_pl / cost_basis * 100) if cost_basis > 0 else 0
            total_positions_value += current_value

            positions_list.append({
                "position_key": pos_key,
                "market_id": market_id,
                "question": question,
                "outcome": outcome,
                "contracts": contracts,
                "avg_cost": round(avg_cost, 4),
                "current_price": round(current_price, 4),
                "current_value": round(current_value, 2),
                "cost_basis": round(cost_basis, 2),
                "total_pl": round(total_pl, 2),
                "total_pl_percent": round(total_pl_percent, 2),
            })

        total_value = portfolio["cash"] + total_positions_value
        starting_cash = portfolio.get("starting_cash", 10000.0)
        total_pl = total_value - starting_cash
        total_return = (total_pl / starting_cash * 100) if starting_cash > 0 else 0

        return jsonify_fn({
            "cash": round(portfolio["cash"], 2),
            "positions_value": round(total_positions_value, 2),
            "total_value": round(total_value, 2),
            "starting_value": starting_cash,
            "total_pl": round(total_pl, 2),
            "total_return": round(total_return, 2),
            "positions": positions_list,
        })
    except Exception as exc:
        log_api_error_fn(logger, '/prediction-markets/portfolio', exc)
        return jsonify_fn({"error": "Failed to load prediction portfolio"}), 500


def buy_prediction_contract_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_prediction_portfolio_fn,
    pm_get_market_fn,
    save_prediction_portfolio_fn,
    jsonify_fn,
    log_api_error_fn,
    logger,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_prediction_portfolio_fn(user_id)
    try:
        data = request_obj.get_json()
        market_id = data['market_id']
        outcome = data['outcome']
        contracts = float(data['contracts'])
        exchange = data.get('exchange', 'polymarket')

        if contracts <= 0:
            return jsonify_fn({"error": "Contracts must be positive"}), 400

        market = pm_get_market_fn(market_id, exchange)
        if not market:
            return jsonify_fn({"error": "Market not found"}), 404
        if not market['is_open']:
            return jsonify_fn({"error": "Market is closed for trading"}), 400
        if outcome not in market['prices']:
            return jsonify_fn({"error": f"Invalid outcome '{outcome}'. Valid: {market['outcomes']}"}), 400

        price = market['prices'][outcome]
        if price <= 0 or price >= 1:
            return jsonify_fn({"error": f"Cannot trade at price {price}"}), 400

        total_cost = contracts * price
        if total_cost > portfolio['cash']:
            return jsonify_fn({"error": f"Insufficient cash. Need ${total_cost:.2f}, have ${portfolio['cash']:.2f}"}), 400

        pos_key = f"{market_id}::{outcome}"
        pos = portfolio['positions'].get(pos_key, {
            'market_id': market_id,
            'outcome': outcome,
            'exchange': exchange,
            'question': market['question'],
            'contracts': 0,
            'avg_cost': 0,
        })

        old_total = pos['contracts'] * pos['avg_cost']
        new_contracts = pos['contracts'] + contracts
        new_avg_cost = (old_total + total_cost) / new_contracts

        pos['contracts'] = new_contracts
        pos['avg_cost'] = new_avg_cost
        portfolio['positions'][pos_key] = pos
        portfolio['cash'] -= total_cost

        trade = {
            'type': 'BUY',
            'market_id': market_id,
            'question': market['question'],
            'outcome': outcome,
            'contracts': contracts,
            'price': price,
            'total': round(total_cost, 4),
            'timestamp': datetime_cls.now().isoformat(),
        }
        portfolio['trade_history'].append(trade)
        save_prediction_portfolio_fn(portfolio, user_id)

        return jsonify_fn({
            'success': True,
            'message': f"Bought {contracts:.0f} '{outcome}' contracts at ${price:.4f} each",
            'total_cost': round(total_cost, 2),
        }), 200
    except Exception as exc:
        log_api_error_fn(logger, '/prediction-markets/buy', exc)
        return jsonify_fn({"error": "Failed to execute buy order"}), 500


def sell_prediction_contract_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_prediction_portfolio_fn,
    pm_get_market_fn,
    save_prediction_portfolio_fn,
    jsonify_fn,
    log_api_error_fn,
    logger,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_prediction_portfolio_fn(user_id)
    try:
        data = request_obj.get_json()
        market_id = data['market_id']
        outcome = data['outcome']
        contracts = float(data['contracts'])
        exchange = data.get('exchange', 'polymarket')

        if contracts <= 0:
            return jsonify_fn({"error": "Contracts must be positive"}), 400

        pos_key = f"{market_id}::{outcome}"
        pos = portfolio['positions'].get(pos_key)
        if not pos or pos['contracts'] < contracts:
            held = pos['contracts'] if pos else 0
            return jsonify_fn({"error": f"Not enough contracts. Have {held:.0f}, trying to sell {contracts:.0f}"}), 400

        market = pm_get_market_fn(market_id, exchange)
        if not market:
            return jsonify_fn({"error": "Market not found"}), 404

        price = market['prices'].get(outcome, pos['avg_cost'])
        proceeds = contracts * price
        profit = proceeds - (contracts * pos['avg_cost'])

        pos['contracts'] -= contracts
        if pos['contracts'] <= 0:
            del portfolio['positions'][pos_key]

        portfolio['cash'] += proceeds
        trade = {
            'type': 'SELL',
            'market_id': market_id,
            'question': market['question'],
            'outcome': outcome,
            'contracts': contracts,
            'price': price,
            'total': round(proceeds, 4),
            'profit': round(profit, 4),
            'timestamp': datetime_cls.now().isoformat(),
        }
        portfolio['trade_history'].append(trade)
        save_prediction_portfolio_fn(portfolio, user_id)

        return jsonify_fn({
            'success': True,
            'message': f"Sold {contracts:.0f} '{outcome}' contracts at ${price:.4f} each",
            'profit': round(profit, 2),
        }), 200
    except Exception as exc:
        log_api_error_fn(logger, '/prediction-markets/sell', exc)
        return jsonify_fn({"error": "Failed to execute sell order"}), 500


def get_prediction_trade_history_handler(*, get_current_user_id_fn, load_prediction_portfolio_fn, jsonify_fn):
    portfolio = load_prediction_portfolio_fn(get_current_user_id_fn())
    return jsonify_fn(portfolio.get('trade_history', [])[-50:])


def reset_prediction_portfolio_handler(*, get_current_user_id_fn, save_prediction_portfolio_fn, jsonify_fn):
    user_id = get_current_user_id_fn()
    new_portfolio = {
        'cash': 10000.0,
        'starting_cash': 10000.0,
        'positions': {},
        'trade_history': [],
    }
    save_prediction_portfolio_fn(new_portfolio, user_id)
    return jsonify_fn({
        'success': True,
        'message': 'Prediction markets portfolio reset to starting state',
        'starting_cash': 10000.0,
    })
