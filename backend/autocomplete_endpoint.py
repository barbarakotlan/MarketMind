# --- NEW: Autocomplete Symbol Search (from Jimmy's branch) ---
def get_symbol_suggestions(query):
    if not ALPHA_VANTAGE_API_KEY:
        print("Alpha Vantage key not configured. Cannot get suggestions.")
        return []
        
    try:
        url = f'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords={query}&apikey={ALPHA_VANTAGE_API_KEY}'
        r = requests.get(url)
        data = r.json()
        
        matches = data.get('bestMatches', [])
        formatted_matches = []
        for match in matches:
            # Filter for US stocks
            if "." not in match.get('1. symbol') and match.get('4. region') == "United States":
                formatted_matches.append({
                    "symbol": match.get('1. symbol'),
                    "name": match.get('2. name')
                })
        return formatted_matches
    except Exception as e:
        print(f"Error in get_symbol_suggestions: {e}")
        return []


@app.route('/search-symbols')
@limiter.limit(RateLimits.LIGHT)
def search_symbols():
    """Autocomplete endpoint for stock symbols"""
    query = request.args.get('q')
    if not query:
        return jsonify([])
        
    try:
        formatted_matches = get_symbol_suggestions(query)
        log_api_request(logger, '/search-symbols', 'GET', status='success')
        return jsonify(formatted_matches)
    except Exception as e:
        log_api_error(logger, '/search-symbols', e)
        print(f"Error in symbol search: {e}")
        return jsonify({"error": str(e)}), 500
# --- END AUTOCOMPLETE ---
