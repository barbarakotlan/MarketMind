from __future__ import annotations


def get_watchlist_handler(*, get_current_user_id_fn, load_watchlist_fn, jsonify_fn):
    return jsonify_fn(load_watchlist_fn(get_current_user_id_fn()))


def add_to_watchlist_handler(
    ticker,
    *,
    get_current_user_id_fn,
    load_watchlist_fn,
    save_watchlist_fn,
    jsonify_fn,
):
    user_id = get_current_user_id_fn()
    current_watchlist = load_watchlist_fn(user_id)
    normalized_ticker = ticker.upper()
    if normalized_ticker not in current_watchlist:
        current_watchlist.append(normalized_ticker)
    save_watchlist_fn(current_watchlist, user_id)
    return jsonify_fn({"message": f"{normalized_ticker} added to watchlist.", "watchlist": current_watchlist}), 201


def remove_from_watchlist_handler(
    ticker,
    *,
    get_current_user_id_fn,
    load_watchlist_fn,
    save_watchlist_fn,
    jsonify_fn,
):
    user_id = get_current_user_id_fn()
    normalized_ticker = ticker.upper()
    current_watchlist = [item for item in load_watchlist_fn(user_id) if item != normalized_ticker]
    save_watchlist_fn(current_watchlist, user_id)
    return jsonify_fn({"message": f"{normalized_ticker} removed from watchlist.", "watchlist": current_watchlist})


def get_stock_data_handler(
    ticker,
    *,
    request_obj,
    alpha_vantage_api_key,
    yf_module,
    requests_module,
    jsonify_fn,
    logger,
    clean_value_fn,
    resolve_asset_fn,
    akshare_service_module,
    exchange_session_service_module,
):
    try:
        market = request_obj.args.get("market")
        asset = resolve_asset_fn(ticker, market)
        if asset["market"] in {"HK", "CN"}:
            try:
                snapshot = dict(akshare_service_module.get_equity_snapshot(asset["assetId"]))
                snapshot["marketSession"] = exchange_session_service_module.get_market_session(
                    asset["market"],
                    exchange=snapshot.get("exchange") or asset["exchange"],
                )
                return jsonify_fn(snapshot)
            except akshare_service_module.AkshareUnavailableError as exc:
                return jsonify_fn({"error": str(exc)}), 503
            except akshare_service_module.AkshareAssetNotFoundError as exc:
                return jsonify_fn({"error": str(exc)}), 404

        sanitized_ticker = asset["symbol"]
        stock = yf_module.Ticker(sanitized_ticker)
        info = stock.info
        if info.get("regularMarketPrice") is None:
            return jsonify_fn({"error": f"Invalid ticker symbol '{ticker}' or no data available."}), 404
        price = info.get("regularMarketPrice", 0)
        previous_close = info.get("previousClose", price)
        change = price - previous_close
        change_percent = (change / previous_close) * 100 if previous_close else 0
        market_cap_int = info.get("marketCap", 0)
        market_cap_formatted = "N/A"
        if market_cap_int >= 1_000_000_000_000:
            market_cap_formatted = f"{market_cap_int / 1_000_000_000_000:.2f}T"
        elif market_cap_int > 0:
            market_cap_formatted = f"{market_cap_int / 1_000_000_000:.2f}B"

        sparkline = []
        try:
            hist = stock.history(period="7d", interval="1d")
            if not hist.empty:
                sparkline = [clean_value_fn(price_val) for price_val in hist["Close"]]
        except Exception as exc:
            logger.warning(f"Could not fetch sparkline data: {exc}")

        financials = {}
        try:
            quarterly_financials = stock.quarterly_financials
            if not quarterly_financials.empty:
                financials = {
                    "revenue": clean_value_fn(quarterly_financials.loc["Total Revenue"].iloc[0]) if "Total Revenue" in quarterly_financials.index else None,
                    "netIncome": clean_value_fn(quarterly_financials.loc["Net Income"].iloc[0]) if "Net Income" in quarterly_financials.index else None,
                    "quarterendDate": str(quarterly_financials.columns[0].date()) if not quarterly_financials.empty else None,
                }
        except Exception as exc:
            logger.warning(f"Could not fetch quarterly financials: {exc}")

        yf_extended = {
            "forwardPE": clean_value_fn(info.get("forwardPE")),
            "pegRatio": clean_value_fn(info.get("pegRatio")),
            "priceToBook": clean_value_fn(info.get("priceToBook")),
            "beta": clean_value_fn(info.get("beta")),
            "dividendYield": clean_value_fn(info.get("dividendYield")),
            "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
        }

        if not alpha_vantage_api_key:
            fundamentals = {
                "peRatio": clean_value_fn(info.get("trailingPE")),
                "week52High": clean_value_fn(info.get("fiftyTwoWeekHigh")),
                "week52Low": clean_value_fn(info.get("fiftyTwoWeekLow")),
                "analystTargetPrice": clean_value_fn(info.get("targetMeanPrice")),
                "recommendationKey": info.get("recommendationKey"),
                "overview": info.get("longBusinessSummary"),
                **yf_extended,
            }
        else:
            try:
                url = (
                    "https://www.alphavantage.co/query"
                    f"?function=OVERVIEW&symbol={sanitized_ticker.upper()}&apikey={alpha_vantage_api_key}"
                )
                response = requests_module.get(url)
                data = response.json()
                if data and "Symbol" in data:
                    fundamentals = {
                        "overview": data.get("Description", "N/A"),
                        "peRatio": clean_value_fn(data.get("PERatio")),
                        "forwardPE": clean_value_fn(data.get("ForwardPE")),
                        "pegRatio": clean_value_fn(data.get("PEGRatio")),
                        "dividendYield": clean_value_fn(data.get("DividendYield")),
                        "beta": clean_value_fn(data.get("Beta")),
                        "week52High": clean_value_fn(data.get("52WeekHigh")),
                        "week52Low": clean_value_fn(data.get("52WeekLow")),
                        "analystTargetPrice": clean_value_fn(data.get("AnalystTargetPrice")),
                        "recommendationKey": "N/A",
                        "priceToBook": clean_value_fn(info.get("priceToBook")),
                        "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
                    }
                else:
                    raise ValueError("No data from Alpha Vantage")
            except Exception as exc:
                logger.warning(f"Could not fetch fundamentals from Alpha Vantage: {exc}. Falling back to yfinance.")
                fundamentals = {
                    "peRatio": clean_value_fn(info.get("trailingPE")),
                    "week52High": clean_value_fn(info.get("fiftyTwoWeekHigh")),
                    "week52Low": clean_value_fn(info.get("fiftyTwoWeekLow")),
                    "analystTargetPrice": clean_value_fn(info.get("targetMeanPrice")),
                    "recommendationKey": info.get("recommendationKey"),
                    "overview": info.get("longBusinessSummary"),
                    **yf_extended,
                }

        formatted_data = {
            "symbol": sanitized_ticker,
            "assetId": asset["assetId"],
            "market": asset["market"],
            "exchange": info.get("exchange", asset["exchange"]),
            "currency": info.get("currency"),
            "companyName": info.get("longName", "N/A"),
            "price": clean_value_fn(price),
            "change": clean_value_fn(change),
            "changePercent": clean_value_fn(change_percent),
            "marketCap": market_cap_formatted,
            "sparkline": sparkline,
            "fundamentals": fundamentals,
            "financials": financials,
        }
        formatted_data["marketSession"] = exchange_session_service_module.get_market_session(
            asset["market"],
            exchange=formatted_data.get("exchange") or asset["exchange"],
        )
        return jsonify_fn(formatted_data)
    except Exception as exc:
        return jsonify_fn({"error": f"An error occurred: {str(exc)}"}), 500


def get_chart_data_handler(
    ticker,
    *,
    request_obj,
    yf_module,
    jsonify_fn,
    logger,
    clean_value_fn,
    chart_prediction_points_fn,
    resolve_asset_fn,
    akshare_service_module,
):
    period = request_obj.args.get("period", "6mo")
    market = request_obj.args.get("market")
    asset = resolve_asset_fn(ticker, market)
    if asset["market"] in {"HK", "CN"}:
        try:
            return jsonify_fn(akshare_service_module.get_equity_chart(asset["assetId"], period=period))
        except akshare_service_module.AkshareUnavailableError as exc:
            return jsonify_fn({"error": str(exc)}), 503
        except akshare_service_module.AkshareAssetNotFoundError as exc:
            return jsonify_fn({"error": str(exc)}), 404

    sanitized_ticker = asset["symbol"]
    period_interval_map = {
        "1d": {"period": "1d", "interval": "5m"},
        "5d": {"period": "5d", "interval": "15m"},
        "14d": {"period": "14d", "interval": "1d"},
        "1mo": {"period": "1mo", "interval": "1d"},
        "6mo": {"period": "6mo", "interval": "1d"},
        "1y": {"period": "1y", "interval": "1d"},
    }
    params = period_interval_map.get(period)
    if not params:
        return jsonify_fn({"error": "Invalid time frame specified."}), 400
    try:
        stock = yf_module.Ticker(sanitized_ticker)
        hist = stock.history(period=params["period"], interval=params["interval"])
        if hist.empty:
            return jsonify_fn({"error": "Could not retrieve time series data."}), 404
        chart_data = []
        for index, row in hist.iterrows():
            chart_data.append(
                {
                    "date": index.strftime("%Y-%m-%d %H:%M:%S"),
                    "open": clean_value_fn(row["Open"]),
                    "high": clean_value_fn(row["High"]),
                    "low": clean_value_fn(row["Low"]),
                    "close": clean_value_fn(row["Close"]),
                    "volume": clean_value_fn(row["Volume"]),
                }
            )
        try:
            chart_data.extend(chart_prediction_points_fn(sanitized_ticker))
        except Exception as exc:
            logger.warning(f"Could not append prediction to chart: {exc}")
        return jsonify_fn(chart_data)
    except Exception as exc:
        return jsonify_fn({"error": f"An error occurred while fetching chart data: {str(exc)}"}), 500


def get_query_news_handler(*, request_obj, news_api_key, requests_module, jsonify_fn):
    query = request_obj.args.get("q")
    if not query:
        return jsonify_fn({"error": "A search query ('q') is required."}), 400
    if not news_api_key:
        return jsonify_fn({"error": "NewsAPI key is not configured"}), 500
    try:
        url = (
            "https://newsapi.org/v2/everything?"
            f"q={query}&searchIn=title,description&language=en&pageSize=8"
            f"&sortBy=relevancy&apiKey={news_api_key}"
        )
        response = requests_module.get(url)
        data = response.json()
        if data.get("status") != "ok":
            return jsonify_fn({"error": data.get("message", "Failed to fetch news")}), 500
        formatted_news = [
            {
                "title": item.get("title"),
                "publisher": item.get("source", {}).get("name", "N/A"),
                "link": item.get("url"),
                "publishTime": item.get("publishedAt", "N/A"),
                "thumbnail_url": item.get("urlToImage"),
            }
            for item in data.get("articles", [])
        ]
        return jsonify_fn(formatted_news)
    except Exception as exc:
        return jsonify_fn({"error": f"An error occurred while fetching news: {str(exc)}"}), 500


def get_options_stock_price_handler(ticker, *, yf_module, jsonify_fn, clean_value_fn):
    try:
        sanitized_ticker = ticker.split(":")[0]
        stock = yf_module.Ticker(sanitized_ticker)
        info = stock.info
        price = info.get("regularMarketPrice", 0)
        if price == 0:
            price = info.get("previousClose", 0)
        return jsonify_fn({"ticker": sanitized_ticker.upper(), "price": clean_value_fn(price)})
    except Exception as exc:
        return jsonify_fn({"error": str(exc)}), 500


def get_option_expirations_handler(ticker, *, yf_module, jsonify_fn):
    try:
        sanitized_ticker = ticker.split(":")[0]
        stock = yf_module.Ticker(sanitized_ticker)
        expirations = stock.options
        if not expirations:
            return jsonify_fn({"error": "No options found for this ticker."}), 404
        return jsonify_fn(list(expirations))
    except Exception as exc:
        return jsonify_fn({"error": str(exc)}), 500


def get_option_chain_handler(ticker, *, request_obj, yf_module, jsonify_fn, math_module, logger):
    try:
        option_date = request_obj.args.get("date")
        stock = yf_module.Ticker(ticker)
        info = stock.info
        stock_price = info.get("regularMarketPrice", info.get("previousClose", 0))
        chain = stock.option_chain(option_date) if option_date else stock.option_chain(stock.options[0])

        def safe_float(val):
            return 0 if math_module.isnan(float(val)) else float(val)

        def safe_int(val):
            return 0 if math_module.isnan(float(val)) else int(val)

        formatted_calls = [
            {
                "contractSymbol": contract["contractSymbol"],
                "strike": safe_float(contract["strike"]),
                "bid": safe_float(contract["bid"]),
                "ask": safe_float(contract["ask"]),
                "lastPrice": safe_float(contract["lastPrice"]),
                "volume": safe_int(contract.get("volume", 0)),
                "openInterest": safe_int(contract.get("openInterest", 0)),
                "impliedVolatility": safe_float(contract.get("impliedVolatility", 0)),
            }
            for contract in chain.calls.to_dict("records")
        ]

        formatted_puts = [
            {
                "contractSymbol": contract["contractSymbol"],
                "strike": safe_float(contract["strike"]),
                "bid": safe_float(contract["bid"]),
                "ask": safe_float(contract["ask"]),
                "lastPrice": safe_float(contract["lastPrice"]),
                "volume": safe_int(contract.get("volume", 0)),
                "openInterest": safe_int(contract.get("openInterest", 0)),
                "impliedVolatility": safe_float(contract.get("impliedVolatility", 0)),
            }
            for contract in chain.puts.to_dict("records")
        ]

        return jsonify_fn({"stock_price": stock_price, "calls": formatted_calls, "puts": formatted_puts})
    except Exception as exc:
        logger.error(f"Error fetching option chain: {exc}")
        return jsonify_fn({"error": str(exc)}), 500


def get_option_suggestion_handler(ticker, *, generate_suggestion_fn, jsonify_fn, logger):
    try:
        sanitized_ticker = ticker.split(":")[0].upper()
        suggestion = generate_suggestion_fn(sanitized_ticker)
        if "error" in suggestion:
            return jsonify_fn(suggestion), 404
        return jsonify_fn(suggestion)
    except Exception as exc:
        logger.error(f"Error in suggestion endpoint for {ticker}: {exc}")
        return jsonify_fn({"error": f"An unexpected error occurred: {str(exc)}"}), 500


def predict_stock_handler(
    model,
    ticker,
    *,
    create_dataset_fn,
    future_prediction_dates_fn,
    linear_regression_predict_fn,
    random_forest_predict_fn,
    xgboost_predict_fn,
    lstm_train_fn=None,
    lstm_predict_fn=None,
    transformer_train_fn=None,
    transformer_predict_fn=None,
    yf_module,
    jsonify_fn,
    log_api_error_fn,
    logger,
    pd_module,
):
    try:
        sanitized_ticker = ticker.split(":")[0]
        stock = yf_module.Ticker(sanitized_ticker)
        info = stock.info

        if model == "LinReg":
            period = "6mo"
            min_rows = 40
        elif model in ("RandomForest", "XGBoost"):
            period = "6mo"
            min_rows = 40
        elif model in ("LSTM", "Transformer"):
            period = "1y"
            min_rows = 200
        else:
            return jsonify_fn({"error": "Unknown model"}), 400

        df = create_dataset_fn(sanitized_ticker, period=period)
        if df.empty or len(df) < min_rows:
            return jsonify_fn({"error": "Insufficient historical data."}), 404

        if model == "LinReg":
            preds = linear_regression_predict_fn(df, days_ahead=7)
        elif model == "RandomForest":
            preds = random_forest_predict_fn(df, days_ahead=7)
        elif model == "XGBoost":
            preds = xgboost_predict_fn(df, days_ahead=7)
        elif model == 'LSTM':
            trained, scaler_X, scaler_y, device = lstm_train_fn(
                df, lookback=14, seq_len=30, days_ahead=7,
                hidden_size=64, layer_size=2, epochs=100, batch_size=32, lr=0.001
            )
            preds = lstm_predict_fn(df, trained, scaler_X, scaler_y, device, lookback=14, seq_len=30)
        elif model == 'Transformer':
            trained, scaler_X, scaler_y, device = transformer_train_fn(
                df, lookback=14, seq_len=30, days_ahead=7,
                d_model=64, nhead=4, num_layers=2, epochs=100, batch_size=32, lr=0.001
            )
            preds = transformer_predict_fn(df, trained, scaler_X, scaler_y, device, lookback=14, seq_len=30)
        else:
            return jsonify_fn({"error": f"Unknown model: {model}"}), 400

        if preds is None or len(preds) == 0:
            return jsonify_fn({"error": f"{model} prediction failed."}), 400

        recent_close = float(df["Close"].iloc[-1])
        recent_date = df.index[-1]
        future_dates = future_prediction_dates_fn(df, len(preds))
        if not future_dates:
            future_dates = [recent_date + pd_module.Timedelta(days=i + 1) for i in range(len(preds))]

        response = {
            "symbol": info.get("symbol", sanitized_ticker.upper()),
            "companyName": info.get("longName", "N/A"),
            "recentDate": recent_date.strftime("%Y-%m-%d"),
            "recentClose": round(recent_close, 2),
            "recentPredicted": round(float(preds[0]), 2),
            "predictions": [
                {"date": date_val.strftime("%Y-%m-%d"), "predictedClose": round(float(pred), 2)}
                for date_val, pred in zip(future_dates, preds)
            ],
        }
        return jsonify_fn(response)
    except Exception as exc:
        log_api_error_fn(logger, f"/predict/{ticker}", exc, ticker)
        return jsonify_fn({"error": f"Prediction failed: {str(exc)}"}), 500


def predict_ensemble_handler(
    ticker,
    *,
    request_obj,
    future_prediction_dates_fn,
    yf_module,
    live_ensemble_signal_components_fn,
    jsonify_fn,
    logger,
    pd_module,
    np_module,
):
    try:
        sanitized_ticker = ticker.split(":")[0]
        stock = yf_module.Ticker(sanitized_ticker)
        info = stock.info
        signal_parts = live_ensemble_signal_components_fn(sanitized_ticker)
        if signal_parts is None:
            return jsonify_fn({"error": "Insufficient historical data."}), 404

        df = signal_parts["df"]
        ensemble_preds = signal_parts["ensemble_preds"]
        individual_preds = signal_parts["individual_preds"]
        recent_close = signal_parts["recent_close"]

        recent_date = df.index[-1]
        future_dates = future_prediction_dates_fn(df, len(ensemble_preds))
        if not future_dates:
            future_dates = [recent_date + pd_module.Timedelta(days=i + 1) for i in range(len(ensemble_preds))]

        confidence = (
            round(95.0 - (np_module.std(list(individual_preds.values())) * 2), 1)
            if len(individual_preds) > 1
            else 85.0
        )

        response = {
            "symbol": info.get("symbol", ticker.upper()),
            "companyName": info.get("longName", "N/A"),
            "recentDate": recent_date.strftime("%Y-%m-%d"),
            "recentClose": round(recent_close, 2),
            "recentPredicted": round(float(ensemble_preds[0]), 2),
            "predictions": [
                {"date": date_val.strftime("%Y-%m-%d"), "predictedClose": round(float(pred), 2)}
                for date_val, pred in zip(future_dates, ensemble_preds)
            ],
            "modelBreakdown": {
                model_name: [round(float(pred_val), 2) for pred_val in preds]
                for model_name, preds in individual_preds.items()
            },
            "modelsUsed": list(individual_preds.keys()),
            "ensembleMethod": "weighted_average",
            "confidence": confidence,
        }
        return jsonify_fn(response)
    except Exception as exc:
        logger.error(f"Error in ensemble prediction for {ticker}: {exc}")
        return jsonify_fn({"error": f"Ensemble prediction failed: {str(exc)}"}), 500


def evaluate_models_handler(
    ticker,
    *,
    request_obj,
    rolling_window_backtest_fn,
    jsonify_fn,
    logger,
):
    try:
        sanitized_ticker = ticker.split(":")[0]
        test_days = int(request_obj.args.get("test_days", 60))
        fast_mode_raw = str(request_obj.args.get("fast_mode", "true")).strip().lower()
        fast_mode = fast_mode_raw in {"1", "true", "yes", "on"}
        default_retrain = 10 if fast_mode else 5
        retrain_frequency = int(request_obj.args.get("retrain_frequency", default_retrain))
        max_train_rows = request_obj.args.get("max_train_rows", default=450 if fast_mode else None, type=int)
        include_explanations_raw = request_obj.args.get("include_explanations")
        include_explanations = None
        if include_explanations_raw is not None:
            include_explanations = str(include_explanations_raw).strip().lower() in {"1", "true", "yes", "on"}

        result = rolling_window_backtest_fn(
            sanitized_ticker,
            test_days=test_days,
            retrain_frequency=retrain_frequency,
            fast_mode=fast_mode,
            max_train_rows=max_train_rows,
            include_explanations=include_explanations,
        )
        if result is None:
            return jsonify_fn({"error": "Insufficient data for evaluation"}), 404
        return jsonify_fn(result)
    except Exception as exc:
        logger.error(f"Evaluation error for {ticker}: {exc}")
        return jsonify_fn({"error": f"Evaluation failed: {str(exc)}"}), 500


def search_symbols_handler(
    *,
    request_obj,
    get_symbol_suggestions_fn,
    search_international_symbols_fn,
    jsonify_fn,
    logger,
):
    query = request_obj.args.get("q")
    if not query:
        return jsonify_fn([])
    market = str(request_obj.args.get("market", "us")).strip().lower()
    try:
        combined_matches = []
        if market in {"us", "all"}:
            combined_matches.extend(get_symbol_suggestions_fn(query))
        if market in {"hk", "cn", "all"}:
            combined_matches.extend(search_international_symbols_fn(query, market=market))

        seen = set()
        deduped = []
        for match in combined_matches:
            asset_id = match.get("assetId") or f"US:{match.get('symbol', '').upper()}"
            if asset_id in seen:
                continue
            seen.add(asset_id)
            deduped.append(match)
        return jsonify_fn(deduped)
    except Exception as exc:
        logger.error(f"Error in symbol search: {exc}")
        return jsonify_fn({"error": str(exc)}), 500
