from __future__ import annotations


def optimize_paper_portfolio_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    optimize_portfolio_fn,
    error_cls,
    jsonify_fn,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    payload = request_obj.get_json(silent=True) or {}
    try:
        result = optimize_portfolio_fn(
            portfolio,
            method=payload.get("method"),
            use_predictions=payload.get("use_predictions", True),
            lookback_days=payload.get("lookback_days"),
            max_weight=payload.get("max_weight"),
        )
        return jsonify_fn(result)
    except error_cls as exc:
        return jsonify_fn({"error": str(exc), **exc.payload}), exc.status_code


def get_paper_portfolio_handler(
    *,
    get_current_user_id_fn,
    load_portfolio_fn,
    jsonify_fn,
    yf_module,
    pd_module,
    logger,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    positions = portfolio.get('positions', {})
    options_positions = portfolio.get('options_positions', {})

    total_positions_value = 0
    positions_list = []

    tickers_to_fetch = list(positions.keys())
    if tickers_to_fetch:
        try:
            data = yf_module.download(tickers_to_fetch, period='2d')
            if not data.empty:
                current_prices = data['Close'].iloc[-1]
                prev_close_prices = data['Close'].iloc[0]

                for ticker, pos in positions.items():
                    shares = float(pos['shares'])
                    avg_cost = float(pos['avg_cost'])

                    if len(tickers_to_fetch) == 1:
                        current_price = float(current_prices)
                        prev_close = float(prev_close_prices)
                    else:
                        current_price = float(current_prices.get(ticker, 0))
                        prev_close = float(prev_close_prices.get(ticker, 0))

                    if pd_module.isna(current_price) or current_price == 0:
                        current_price = avg_cost
                    if pd_module.isna(prev_close):
                        prev_close = current_price

                    cost_basis = shares * avg_cost
                    current_value = shares * current_price
                    total_pl = current_value - cost_basis
                    total_pl_percent = (total_pl / cost_basis * 100) if cost_basis > 0 else 0
                    daily_pl = shares * (current_price - prev_close)
                    daily_pl_percent = ((current_price - prev_close) / prev_close * 100) if prev_close > 0 else 0

                    total_positions_value += current_value

                    positions_list.append({
                        'ticker': ticker,
                        'company_name': yf_module.Ticker(ticker).info.get('longName', 'N/A'),
                        'shares': shares,
                        'avg_cost': round(avg_cost, 2),
                        'current_price': round(current_price, 2),
                        'current_value': round(current_value, 2),
                        'cost_basis': round(cost_basis, 2),
                        'total_pl': round(total_pl, 2),
                        'total_pl_percent': round(total_pl_percent, 2),
                        'daily_pl': round(daily_pl, 2),
                        'daily_pl_percent': round(daily_pl_percent, 2),
                        'isOption': False,
                    })
        except Exception as exc:
            logger.error(f'Error processing stock positions: {exc}')
            for ticker, pos in positions.items():
                positions_list.append({
                    'ticker': ticker,
                    'company_name': 'N/A (Error)',
                    'shares': pos['shares'],
                    'avg_cost': round(pos['avg_cost'], 2),
                    'current_price': round(pos['avg_cost'], 2),
                    'current_value': round(pos['shares'] * pos['avg_cost'], 2),
                    'cost_basis': round(pos['shares'] * pos['avg_cost'], 2),
                    'total_pl': 0,
                    'total_pl_percent': 0,
                    'daily_pl': 0,
                    'daily_pl_percent': 0,
                    'isOption': False,
                })

    options_positions_list = []
    total_options_value = 0
    for contract_symbol, pos in options_positions.items():
        current_price = float(pos['avg_cost'])
        fetched_successfully = False

        try:
            opt_ticker = yf_module.Ticker(contract_symbol)
            hist = opt_ticker.history(period='1d')
            if not hist.empty:
                current_price = float(hist['Close'].iloc[-1])
                fetched_successfully = True

            if not fetched_successfully:
                info = opt_ticker.info
                live_val = info.get('bid') or info.get('ask') or info.get('regularMarketPrice') or info.get('lastPrice')
                if live_val and live_val > 0:
                    current_price = float(live_val)
                    fetched_successfully = True

            if not fetched_successfully:
                fast_val = opt_ticker.fast_info.get('last_price')
                if fast_val and fast_val > 0:
                    current_price = float(fast_val)
        except Exception as exc:
            logger.warning(f'Could not fetch live price for option {contract_symbol}: {exc}')

        current_value = pos['quantity'] * current_price * 100
        cost_basis = pos['quantity'] * pos['avg_cost'] * 100
        total_pl = current_value - cost_basis
        total_pl_percent = (total_pl / cost_basis * 100) if cost_basis > 0 else 0
        total_options_value += current_value

        options_positions_list.append({
            'ticker': contract_symbol,
            'company_name': contract_symbol,
            'shares': pos['quantity'],
            'avg_cost': round(pos['avg_cost'], 2),
            'current_price': round(current_price, 2),
            'current_value': round(current_value, 2),
            'cost_basis': round(cost_basis, 2),
            'total_pl': round(total_pl, 2),
            'total_pl_percent': round(total_pl_percent, 2),
            'daily_pl': 0,
            'daily_pl_percent': 0,
            'isOption': True,
        })

    total_portfolio_value = portfolio['cash'] + total_positions_value + total_options_value
    starting_cash = portfolio.get('starting_cash', 100000.0)
    total_pl = total_portfolio_value - starting_cash
    total_return = (total_pl / starting_cash * 100) if starting_cash > 0 else 0

    return jsonify_fn({
        'cash': round(portfolio['cash'], 2),
        'positions_value': round(total_positions_value, 2),
        'options_value': round(total_options_value, 2),
        'total_value': round(total_portfolio_value, 2),
        'starting_value': starting_cash,
        'total_pl': round(total_pl, 2),
        'total_return': round(total_return, 2),
        'positions': positions_list,
        'options_positions': options_positions_list,
    })


def buy_stock_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    selector_gate_fn,
    jsonify_fn,
    yf_module,
    to_bool_fn,
    selective_modes,
    selector_source_requestable,
    selective_disabled_statuses,
    log_api_error_fn,
    logger,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    try:
        data = request_obj.get_json()
        ticker = data.get('ticker', '').upper()
        shares = float(data.get('shares', 0))
        if shares <= 0:
            return jsonify_fn({'error': 'Shares must be positive'}), 400
        enforce_selector = to_bool_fn(data.get('enforce_selector', False))
        requested_mode = str(data.get('abstain_mode', 'conservative')).strip().lower() if enforce_selector else 'none'
        if requested_mode not in selective_modes:
            requested_mode = 'conservative' if enforce_selector else 'none'
        selector_source_requested = str(data.get('selector_source', 'auto')).strip().lower() if enforce_selector else 'auto'
        if selector_source_requested not in selector_source_requestable:
            selector_source_requested = 'auto'
        if enforce_selector:
            selector_gate = selector_gate_fn(ticker, requested_mode, selector_source_requested)
            mode_disabled = selector_gate.get('selector_status') in selective_disabled_statuses
            if selector_gate.get('abstain') or mode_disabled:
                return jsonify_fn({
                    'error': 'Trade blocked by selective prediction gate',
                    'reason': selector_gate.get('abstain_reason') or selector_gate.get('selector_status'),
                    'selector_gate': selector_gate,
                }), 409
        stock = yf_module.Ticker(ticker)
        info = stock.info
        price = info.get('regularMarketPrice')
        if price is None or price == 0:
            price = info.get('previousClose', 0)
        if price is None or price == 0:
            return jsonify_fn({'error': f'Could not get price for {ticker}'}), 404
        total_cost = shares * price
        if total_cost > portfolio['cash']:
            return jsonify_fn({'error': f'Insufficient cash. Need ${total_cost:.2f}, have ${portfolio["cash"]:.2f}'}), 400
        pos = portfolio['positions'].get(ticker, {'shares': 0, 'avg_cost': 0})
        new_total_shares = pos['shares'] + shares
        new_avg_cost = ((pos['avg_cost'] * pos['shares']) + total_cost) / new_total_shares
        portfolio['positions'][ticker] = {'shares': new_total_shares, 'avg_cost': new_avg_cost}
        portfolio['cash'] -= total_cost
        trade = {
            'type': 'BUY',
            'ticker': ticker,
            'shares': shares,
            'price': price,
            'total': total_cost,
            'timestamp': datetime_cls.now().isoformat(),
        }
        portfolio['trade_history'].append(trade)
        portfolio['transactions'].append({
            'date': datetime_cls.now().strftime('%Y-%m-%d'),
            'type': 'BUY',
            'ticker': ticker,
            'shares': shares,
            'price': price,
            'total': total_cost,
        })
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Bought {shares} shares of {ticker} at ${price:.2f}'}), 200
    except Exception as exc:
        log_api_error_fn(logger, '/paper/buy', exc)
        return jsonify_fn({'error': 'Failed to execute buy order'}), 500


def sell_stock_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    selector_gate_fn,
    jsonify_fn,
    yf_module,
    to_bool_fn,
    selective_modes,
    selector_source_requestable,
    selective_disabled_statuses,
    log_api_error_fn,
    logger,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    try:
        data = request_obj.get_json()
        ticker = data.get('ticker', '').upper()
        shares = float(data.get('shares', 0))
        if shares <= 0:
            return jsonify_fn({'error': 'Shares must be positive'}), 400
        enforce_selector = to_bool_fn(data.get('enforce_selector', False))
        requested_mode = str(data.get('abstain_mode', 'conservative')).strip().lower() if enforce_selector else 'none'
        if requested_mode not in selective_modes:
            requested_mode = 'conservative' if enforce_selector else 'none'
        selector_source_requested = str(data.get('selector_source', 'auto')).strip().lower() if enforce_selector else 'auto'
        if selector_source_requested not in selector_source_requestable:
            selector_source_requested = 'auto'
        if enforce_selector:
            selector_gate = selector_gate_fn(ticker, requested_mode, selector_source_requested)
            mode_disabled = selector_gate.get('selector_status') in selective_disabled_statuses
            if selector_gate.get('abstain') or mode_disabled:
                return jsonify_fn({
                    'error': 'Trade blocked by selective prediction gate',
                    'reason': selector_gate.get('abstain_reason') or selector_gate.get('selector_status'),
                    'selector_gate': selector_gate,
                }), 409
        pos = portfolio['positions'].get(ticker)
        if not pos or pos['shares'] < shares:
            return jsonify_fn({'error': f'Not enough shares. You have {pos.get("shares", 0)}, trying to sell {shares}'}), 400
        stock = yf_module.Ticker(ticker)
        info = stock.info
        price = info.get('regularMarketPrice')
        if price is None or price == 0:
            price = info.get('previousClose', 0)
        if price is None or price == 0:
            return jsonify_fn({'error': f'Could not get price for {ticker}'}), 404
        proceeds = shares * price
        profit = proceeds - (shares * pos['avg_cost'])
        pos['shares'] -= shares
        if pos['shares'] == 0:
            del portfolio['positions'][ticker]
        portfolio['cash'] += proceeds
        trade = {
            'type': 'SELL',
            'ticker': ticker,
            'shares': shares,
            'price': price,
            'total': proceeds,
            'profit': profit,
            'timestamp': datetime_cls.now().isoformat(),
        }
        portfolio['trade_history'].append(trade)
        portfolio['transactions'].append({
            'date': datetime_cls.now().strftime('%Y-%m-%d'),
            'type': 'SELL',
            'ticker': ticker,
            'shares': shares,
            'price': price,
            'total': proceeds,
        })
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Sold {shares} shares of {ticker} at ${price:.2f}', 'profit': round(profit, 2)}), 200
    except Exception as exc:
        log_api_error_fn(logger, '/paper/sell', exc)
        return jsonify_fn({'error': 'Failed to execute sell order'}), 500


def buy_option_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    jsonify_fn,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    try:
        data = request_obj.get_json()
        contract_symbol = data.get('contractSymbol')
        quantity = int(data.get('quantity', 0))
        price = float(data.get('price', 0))
        if quantity <= 0:
            return jsonify_fn({'error': 'Quantity must be positive'}), 400
        if price == 0:
            return jsonify_fn({'error': 'Cannot buy an option with no premium.'}), 400
        total_cost = quantity * price * 100
        if total_cost > portfolio['cash']:
            return jsonify_fn({'error': f'Insufficient cash. Need ${total_cost:.2f}, have ${portfolio["cash"]:.2f}'}), 400
        pos = portfolio['options_positions'].get(contract_symbol, {'quantity': 0, 'avg_cost': 0})
        new_total_quantity = pos['quantity'] + quantity
        new_avg_cost = ((pos['avg_cost'] * pos['quantity']) + (price * quantity)) / new_total_quantity
        portfolio['options_positions'][contract_symbol] = {'quantity': new_total_quantity, 'avg_cost': new_avg_cost}
        portfolio['cash'] -= total_cost
        trade = {
            'type': 'BUY_OPTION',
            'ticker': contract_symbol,
            'shares': quantity,
            'price': price,
            'total': total_cost,
            'timestamp': datetime_cls.now().isoformat(),
        }
        portfolio['trade_history'].append(trade)
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Bought {quantity} {contract_symbol} contract(s) at ${price:.2f}'}), 200
    except Exception as exc:
        return jsonify_fn({'error': str(exc)}), 500


def sell_option_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    jsonify_fn,
    datetime_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    try:
        data = request_obj.get_json()
        contract_symbol = data.get('contractSymbol')
        quantity = int(data.get('quantity', 0))
        price = float(data.get('price', 0))
        if quantity <= 0:
            return jsonify_fn({'error': 'Quantity must be positive'}), 400
        if price == 0:
            return jsonify_fn({'error': 'Cannot sell an option for no premium.'}), 400
        pos = portfolio['options_positions'].get(contract_symbol)
        if not pos or pos['quantity'] < quantity:
            return jsonify_fn({'error': f'Not enough contracts. You have {pos.get("quantity", 0)}, trying to sell {quantity}'}), 400
        proceeds = quantity * price * 100
        profit = proceeds - (quantity * pos['avg_cost'] * 100)
        pos['quantity'] -= quantity
        if pos['quantity'] == 0:
            del portfolio['options_positions'][contract_symbol]
        portfolio['cash'] += proceeds
        trade = {
            'type': 'SELL_OPTION',
            'ticker': contract_symbol,
            'shares': quantity,
            'price': price,
            'total': proceeds,
            'profit': profit,
            'timestamp': datetime_cls.now().isoformat(),
        }
        portfolio['trade_history'].append(trade)
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Sold {quantity} {contract_symbol} contract(s) at ${price:.2f}', 'profit': round(profit, 2)}), 200
    except Exception as exc:
        return jsonify_fn({'error': str(exc)}), 500


def get_paper_history_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    jsonify_fn,
    yf_module,
    pd_module,
    np_module,
    logger,
    datetime_cls,
    date_cls,
    timedelta_cls,
):
    user_id = get_current_user_id_fn()
    portfolio = load_portfolio_fn(user_id)
    transactions = portfolio.get('transactions', [])
    if not transactions:
        return jsonify_fn({'dates': [], 'values': [], 'summary': {}})
    try:
        first_tx_date = datetime_cls.strptime(transactions[0]['date'], '%Y-%m-%d').date()
    except (IndexError, ValueError):
        return jsonify_fn({'dates': [], 'values': [], 'summary': {}})

    period = request_obj.args.get('period', 'ytd')
    today = date_cls.today()
    if period == '1m':
        start_date = today - timedelta_cls(days=30)
    elif period == '3m':
        start_date = today - timedelta_cls(days=90)
    elif period == '1y':
        start_date = today - timedelta_cls(days=365)
    elif period == 'ytd':
        start_date = date_cls(today.year, 1, 1)
    else:
        start_date = first_tx_date
    end_date = today
    if start_date > end_date:
        start_date = end_date
    if start_date < first_tx_date:
        start_date = first_tx_date

    all_tickers = list(set([t['ticker'] for t in transactions if t['type'] in ['BUY', 'SELL']]))
    if not all_tickers:
        return jsonify_fn({'dates': [], 'values': [], 'summary': {}})

    try:
        hist_data = yf_module.download(all_tickers, start=start_date - timedelta_cls(days=7), end=end_date + timedelta_cls(days=1))
        if hist_data.empty:
            return jsonify_fn({'error': 'Could not fetch historical data for portfolio tickers.'}), 500

        close_prices_raw = hist_data.get('Close')
        if close_prices_raw is None:
            return jsonify_fn({'error': "Could not get 'Close' price data from yfinance."}), 500

        if isinstance(close_prices_raw, pd_module.Series):
            close_prices = pd_module.DataFrame({all_tickers[0]: close_prices_raw})
        elif isinstance(close_prices_raw, (float, np_module.float64)):
            close_prices = pd_module.DataFrame({all_tickers[0]: [close_prices_raw]}, index=hist_data.index)
        else:
            close_prices = close_prices_raw

        initial_cash = 100000.0
        initial_positions = {}
        net_contributions = 0
        for tx in transactions:
            tx_date = datetime_cls.strptime(tx['date'], '%Y-%m-%d').date()
            if tx_date < start_date:
                shares = float(tx['shares'])
                total = float(tx['total'])
                ticker = tx['ticker']
                if tx['type'] == 'BUY':
                    initial_cash -= total
                    initial_positions[ticker] = initial_positions.get(ticker, 0) + shares
                elif tx['type'] == 'SELL':
                    initial_cash += total
                    initial_positions[ticker] -= shares

        start_value = initial_cash
        for ticker, shares in initial_positions.items():
            if shares > 0 and ticker in close_prices.columns:
                try:
                    price = close_prices[ticker].asof(start_date)
                    if not pd_module.isna(price):
                        start_value += shares * float(price)
                except (KeyError, TypeError):
                    pass

        date_range = pd_module.date_range(start=start_date, end=end_date, freq='D')
        portfolio_values = []
        current_cash = initial_cash
        current_positions = initial_positions.copy()
        tx_by_date = {}
        for tx in transactions:
            tx_date = datetime_cls.strptime(tx['date'], '%Y-%m-%d').date()
            if start_date <= tx_date <= end_date:
                tx_by_date.setdefault(tx_date, []).append(tx)

        for day in date_range:
            day_str = day.strftime('%Y-%m-%d')
            if day.date() in tx_by_date:
                for tx in tx_by_date[day.date()]:
                    shares = float(tx['shares'])
                    total = float(tx['total'])
                    ticker = tx['ticker']
                    if tx['type'] == 'BUY':
                        current_cash -= total
                        current_positions[ticker] = current_positions.get(ticker, 0) + shares
                    elif tx['type'] == 'SELL':
                        current_cash += total
                        current_positions[ticker] -= shares
            total_holdings_value = 0
            for ticker, shares in current_positions.items():
                if shares > 0 and ticker in close_prices.columns:
                    try:
                        price = close_prices[ticker].asof(day)
                        if not pd_module.isna(price):
                            total_holdings_value += shares * float(price)
                    except (KeyError, TypeError):
                        pass
            portfolio_values.append({'date': day_str, 'value': total_holdings_value + current_cash})

        end_value = portfolio_values[-1]['value'] if portfolio_values else start_value
        wealth_generated = end_value - start_value - net_contributions
        if start_value == 0 or start_value is None:
            return_cumulative = 0 if wealth_generated == 0 else float('inf')
        else:
            return_cumulative = (wealth_generated / start_value) * 100
        num_days = (end_date - start_date).days
        if num_days <= 0:
            return_annualized = return_cumulative
        elif num_days < 365:
            return_annualized = return_cumulative * (365.0 / num_days)
        else:
            return_annualized = ((1 + (return_cumulative / 100)) ** (365.0 / num_days) - 1) * 100

        summary = {
            'period': period,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'start_value': round(start_value, 2),
            'end_value': round(end_value, 2),
            'wealth_generated': round(wealth_generated, 2),
            'return_cumulative_pct': round(return_cumulative, 2),
            'return_annualized_pct': round(return_annualized, 2),
        }
        return jsonify_fn({
            'dates': [pv['date'] for pv in portfolio_values],
            'values': [round(pv['value'], 2) for pv in portfolio_values],
            'summary': summary,
        })
    except Exception as exc:
        logger.error(f'Error in /paper/history: {exc}')
        return jsonify_fn({'error': f'Failed to build history: {str(exc)}'}), 500


def get_trade_history_handler(*, get_current_user_id_fn, load_portfolio_fn, jsonify_fn):
    portfolio = load_portfolio_fn(get_current_user_id_fn())
    return jsonify_fn(portfolio.get('trade_history', [])[-50:])


def reset_portfolio_handler(*, get_current_user_id_fn, save_portfolio_with_snapshot_fn, jsonify_fn):
    user_id = get_current_user_id_fn()
    new_portfolio = {
        'cash': 100000.0,
        'starting_cash': 100000.0,
        'positions': {},
        'options_positions': {},
        'transactions': [],
        'trade_history': [],
    }
    save_portfolio_with_snapshot_fn(new_portfolio, user_id, reset_snapshots=True)
    return jsonify_fn({
        'success': True,
        'message': 'Portfolio reset to starting state',
        'starting_cash': new_portfolio['starting_cash'],
    })
