from __future__ import annotations

from flask import jsonify
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import logging
import math
import re


OPTION_CONTRACT_PATTERN = re.compile(
    r"^(?P<underlying>[A-Z]{1,6})(?P<expiration>\d{6})(?P<option_type>[CP])(?P<strike>\d{8})$"
)
MAX_OPTION_CONTRACTS_PER_ORDER = 1_000


class OptionOrderValidationError(ValueError):
    pass


class OptionQuoteUnavailableError(RuntimeError):
    pass


def _finite_positive_number(value, field_name):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise OptionOrderValidationError(f"{field_name} must be a finite positive number") from exc
    if not math.isfinite(number) or number <= 0:
        raise OptionOrderValidationError(f"{field_name} must be a finite positive number")
    return number


def _normalize_option_order(data):
    payload = data if isinstance(data, dict) else {}
    contract_symbol = str(payload.get("contractSymbol") or "").strip().upper()
    if not OPTION_CONTRACT_PATTERN.fullmatch(contract_symbol):
        raise OptionOrderValidationError("contractSymbol must be a valid OCC option symbol")

    raw_quantity = payload.get("quantity")
    if isinstance(raw_quantity, bool):
        raise OptionOrderValidationError("quantity must be a positive whole number")
    quantity_number = _finite_positive_number(raw_quantity, "quantity")
    if not quantity_number.is_integer() or quantity_number > MAX_OPTION_CONTRACTS_PER_ORDER:
        raise OptionOrderValidationError(
            f"quantity must be a whole number between 1 and {MAX_OPTION_CONTRACTS_PER_ORDER}"
        )

    displayed_price = _finite_positive_number(payload.get("price"), "price")
    return contract_symbol, int(quantity_number), displayed_price


def resolve_option_market_price(contract_symbol, side, *, yf_module=yf):
    try:
        option_ticker = yf_module.Ticker(contract_symbol)
        info = option_ticker.info or {}
    except Exception as exc:
        raise OptionQuoteUnavailableError(
            f"No executable market quote is available for {contract_symbol}"
        ) from exc
    preferred_fields = (
        ("ask", "regularMarketPrice", "lastPrice", "bid")
        if side == "buy"
        else ("bid", "regularMarketPrice", "lastPrice", "ask")
    )
    candidates = [info.get(field) for field in preferred_fields]

    try:
        candidates.append((option_ticker.fast_info or {}).get("last_price"))
    except Exception:
        pass

    try:
        history = option_ticker.history(period="1d")
        if not history.empty:
            candidates.append(history["Close"].iloc[-1])
    except Exception:
        pass

    for candidate in candidates:
        try:
            price = float(candidate)
        except (TypeError, ValueError):
            continue
        if math.isfinite(price) and price > 0:
            return price
    raise OptionQuoteUnavailableError(f"No executable market quote is available for {contract_symbol}")


def _resolve_server_option_price(resolve_option_price_fn, contract_symbol, side):
    try:
        candidate = float(resolve_option_price_fn(contract_symbol, side))
    except OptionQuoteUnavailableError:
        raise
    except Exception as exc:
        raise OptionQuoteUnavailableError(
            f"No executable market quote is available for {contract_symbol}"
        ) from exc
    if not math.isfinite(candidate) or candidate <= 0:
        raise OptionQuoteUnavailableError(
            f"No executable market quote is available for {contract_symbol}"
        )
    return candidate


def optimize_paper_portfolio_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    optimize_portfolio_fn,
    error_cls,
    jsonify_fn=jsonify,
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
    jsonify_fn=jsonify,
    yf_module=yf,
    pd_module=pd,
    logger=logging.getLogger("marketmind_api"),
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
    execute_trade_fn=None,
    trade_error_cls=(),
    jsonify_fn=jsonify,
    yf_module=yf,
    log_api_error_fn,
    logger=logging.getLogger("marketmind_api"),
    datetime_cls=datetime,
):
    user_id = get_current_user_id_fn()
    try:
        data = request_obj.get_json(silent=True) or {}
        ticker = data.get('ticker', '').upper()
        shares = _finite_positive_number(data.get('shares'), 'shares')
        stock = yf_module.Ticker(ticker)
        info = stock.info
        price = info.get('regularMarketPrice')
        if price is None or not math.isfinite(float(price)) or float(price) <= 0:
            price = info.get('previousClose', 0)
        if price is None or not math.isfinite(float(price)) or float(price) <= 0:
            return jsonify_fn({'error': f'Could not get price for {ticker}'}), 404
        price = float(price)
        timestamp = datetime_cls.now()
        if execute_trade_fn is not None:
            execution = execute_trade_fn(
                user_id,
                action='BUY',
                symbol=ticker,
                quantity=shares,
                price=price,
                occurred_at=timestamp,
            )
            if execution is not None:
                return jsonify_fn({
                    'success': True,
                    'message': f'Bought {shares} shares of {ticker} at ${price:.2f}',
                }), 200

        portfolio = load_portfolio_fn(user_id)
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
            'timestamp': timestamp.isoformat(),
        }
        portfolio['trade_history'].append(trade)
        portfolio['transactions'].append({
            'date': timestamp.strftime('%Y-%m-%d'),
            'type': 'BUY',
            'ticker': ticker,
            'shares': shares,
            'price': price,
            'total': total_cost,
        })
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Bought {shares} shares of {ticker} at ${price:.2f}'}), 200
    except OptionOrderValidationError as exc:
        return jsonify_fn({'error': str(exc)}), 400
    except trade_error_cls as exc:
        return jsonify_fn({'error': str(exc)}), getattr(exc, 'status_code', 400)
    except Exception as exc:
        log_api_error_fn(logger, '/paper/buy', exc)
        return jsonify_fn({'error': 'Failed to execute buy order'}), 500


def sell_stock_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    execute_trade_fn=None,
    trade_error_cls=(),
    jsonify_fn=jsonify,
    yf_module=yf,
    log_api_error_fn,
    logger=logging.getLogger("marketmind_api"),
    datetime_cls=datetime,
):
    user_id = get_current_user_id_fn()
    try:
        data = request_obj.get_json(silent=True) or {}
        ticker = data.get('ticker', '').upper()
        shares = _finite_positive_number(data.get('shares'), 'shares')
        stock = yf_module.Ticker(ticker)
        info = stock.info
        price = info.get('regularMarketPrice')
        if price is None or not math.isfinite(float(price)) or float(price) <= 0:
            price = info.get('previousClose', 0)
        if price is None or not math.isfinite(float(price)) or float(price) <= 0:
            return jsonify_fn({'error': f'Could not get price for {ticker}'}), 404
        price = float(price)
        timestamp = datetime_cls.now()
        if execute_trade_fn is not None:
            execution = execute_trade_fn(
                user_id,
                action='SELL',
                symbol=ticker,
                quantity=shares,
                price=price,
                occurred_at=timestamp,
            )
            if execution is not None:
                profit = execution.get('profit') or 0
                return jsonify_fn({
                    'success': True,
                    'message': f'Sold {shares} shares of {ticker} at ${price:.2f}',
                    'profit': round(profit, 2),
                }), 200

        portfolio = load_portfolio_fn(user_id)
        pos = portfolio['positions'].get(ticker)
        if not pos or pos['shares'] < shares:
            available = pos.get('shares', 0) if pos else 0
            return jsonify_fn({'error': f'Not enough shares. You have {available}, trying to sell {shares}'}), 400
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
            'timestamp': timestamp.isoformat(),
        }
        portfolio['trade_history'].append(trade)
        portfolio['transactions'].append({
            'date': timestamp.strftime('%Y-%m-%d'),
            'type': 'SELL',
            'ticker': ticker,
            'shares': shares,
            'price': price,
            'total': proceeds,
        })
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Sold {shares} shares of {ticker} at ${price:.2f}', 'profit': round(profit, 2)}), 200
    except OptionOrderValidationError as exc:
        return jsonify_fn({'error': str(exc)}), 400
    except trade_error_cls as exc:
        return jsonify_fn({'error': str(exc)}), getattr(exc, 'status_code', 400)
    except Exception as exc:
        log_api_error_fn(logger, '/paper/sell', exc)
        return jsonify_fn({'error': 'Failed to execute sell order'}), 500


def buy_option_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    resolve_option_price_fn,
    execute_trade_fn=None,
    trade_error_cls=(),
    jsonify_fn=jsonify,
    datetime_cls=datetime,
):
    user_id = get_current_user_id_fn()
    try:
        contract_symbol, quantity, _displayed_price = _normalize_option_order(
            request_obj.get_json(silent=True)
        )
        price = _resolve_server_option_price(resolve_option_price_fn, contract_symbol, "buy")
        timestamp = datetime_cls.now()
        if execute_trade_fn is not None:
            execution = execute_trade_fn(
                user_id,
                action='BUY_OPTION',
                symbol=contract_symbol,
                quantity=quantity,
                price=price,
                occurred_at=timestamp,
            )
            if execution is not None:
                return jsonify_fn({
                    'success': True,
                    'message': f'Bought {quantity} {contract_symbol} contract(s) at ${price:.2f}',
                }), 200

        portfolio = load_portfolio_fn(user_id)
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
            'timestamp': timestamp.isoformat(),
        }
        portfolio['trade_history'].append(trade)
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Bought {quantity} {contract_symbol} contract(s) at ${price:.2f}'}), 200
    except OptionOrderValidationError as exc:
        return jsonify_fn({'error': str(exc)}), 400
    except OptionQuoteUnavailableError as exc:
        return jsonify_fn({'error': str(exc)}), 503
    except trade_error_cls as exc:
        return jsonify_fn({'error': str(exc)}), getattr(exc, 'status_code', 400)
    except Exception:
        return jsonify_fn({'error': 'Failed to execute option buy order'}), 500


def sell_option_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    save_portfolio_with_snapshot_fn,
    resolve_option_price_fn,
    execute_trade_fn=None,
    trade_error_cls=(),
    jsonify_fn=jsonify,
    datetime_cls=datetime,
):
    user_id = get_current_user_id_fn()
    try:
        contract_symbol, quantity, _displayed_price = _normalize_option_order(
            request_obj.get_json(silent=True)
        )
        price = _resolve_server_option_price(resolve_option_price_fn, contract_symbol, "sell")
        timestamp = datetime_cls.now()
        if execute_trade_fn is not None:
            execution = execute_trade_fn(
                user_id,
                action='SELL_OPTION',
                symbol=contract_symbol,
                quantity=quantity,
                price=price,
                occurred_at=timestamp,
            )
            if execution is not None:
                profit = execution.get('profit') or 0
                return jsonify_fn({
                    'success': True,
                    'message': f'Sold {quantity} {contract_symbol} contract(s) at ${price:.2f}',
                    'profit': round(profit, 2),
                }), 200

        portfolio = load_portfolio_fn(user_id)
        pos = portfolio['options_positions'].get(contract_symbol)
        if not pos or pos['quantity'] < quantity:
            available = pos.get('quantity', 0) if pos else 0
            return jsonify_fn({'error': f'Not enough contracts. You have {available}, trying to sell {quantity}'}), 400
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
            'timestamp': timestamp.isoformat(),
        }
        portfolio['trade_history'].append(trade)
        save_portfolio_with_snapshot_fn(portfolio, user_id)
        return jsonify_fn({'success': True, 'message': f'Sold {quantity} {contract_symbol} contract(s) at ${price:.2f}', 'profit': round(profit, 2)}), 200
    except OptionOrderValidationError as exc:
        return jsonify_fn({'error': str(exc)}), 400
    except OptionQuoteUnavailableError as exc:
        return jsonify_fn({'error': str(exc)}), 503
    except trade_error_cls as exc:
        return jsonify_fn({'error': str(exc)}), getattr(exc, 'status_code', 400)
    except Exception:
        return jsonify_fn({'error': 'Failed to execute option sell order'}), 500


def get_paper_history_handler(
    *,
    request_obj,
    get_current_user_id_fn,
    load_portfolio_fn,
    jsonify_fn=jsonify,
    yf_module=yf,
    pd_module=pd,
    np_module=np,
    logger=logging.getLogger("marketmind_api"),
    datetime_cls=datetime,
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


def get_trade_history_handler(*, get_current_user_id_fn, load_portfolio_fn, jsonify_fn=jsonify):
    portfolio = load_portfolio_fn(get_current_user_id_fn())
    return jsonify_fn(portfolio.get('trade_history', [])[-50:])


def reset_portfolio_handler(*, get_current_user_id_fn, save_portfolio_with_snapshot_fn, jsonify_fn=jsonify):
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
