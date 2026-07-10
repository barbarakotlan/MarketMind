"""
Cryptocurrency exchange data fetcher using Alpha Vantage
"""
import requests

from config import ALPHA_VANTAGE_API_KEY
from http_policy import DEFAULT_HTTP_TIMEOUT


def get_crypto_exchange_rate(from_crypto='BTC', to_currency='USD'):
    """
    Get real-time exchange rate for cryptocurrency
    
    Args:
        from_crypto: Crypto symbol (e.g., 'BTC', 'ETH')
        to_currency: Target currency code (e.g., 'USD', 'EUR')
    
    Returns:
        Dict with exchange rate information
    """
    try:
        url = 'https://www.alphavantage.co/query'
        params = {
            'function': 'CURRENCY_EXCHANGE_RATE',
            'from_currency': from_crypto.upper(),
            'to_currency': to_currency.upper(),
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=DEFAULT_HTTP_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        
        if 'Realtime Currency Exchange Rate' not in data:
            return None
        
        rate_data = data['Realtime Currency Exchange Rate']
        
        return {
            'from_crypto': {
                'code': rate_data['1. From_Currency Code'],
                'name': rate_data['2. From_Currency Name']
            },
            'to_currency': {
                'code': rate_data['3. To_Currency Code'],
                'name': rate_data['4. To_Currency Name']
            },
            'exchange_rate': float(rate_data['5. Exchange Rate']),
            'bid_price': float(rate_data['8. Bid Price']),
            'ask_price': float(rate_data['9. Ask Price']),
            'last_refreshed': rate_data['6. Last Refreshed'],
            'timezone': rate_data['7. Time Zone']
        }
    
    except Exception as e:
        print(f"Error fetching crypto data: {e}")
        return None


# Major cryptocurrencies with info
CRYPTO_INFO = {
    'BTC': {'name': 'Bitcoin', 'symbol': '₿', 'icon': '🪙'},
    'ETH': {'name': 'Ethereum', 'symbol': 'Ξ', 'icon': '💎'},
    'USDT': {'name': 'Tether', 'symbol': '₮', 'icon': '💵'},
    'BNB': {'name': 'Binance Coin', 'symbol': 'BNB', 'icon': '🟡'},
    'SOL': {'name': 'Solana', 'symbol': 'SOL', 'icon': '☀️'},
    'XRP': {'name': 'Ripple', 'symbol': 'XRP', 'icon': '💧'},
    'USDC': {'name': 'USD Coin', 'symbol': 'USDC', 'icon': '🔵'},
    'ADA': {'name': 'Cardano', 'symbol': 'ADA', 'icon': '🔷'},
    'AVAX': {'name': 'Avalanche', 'symbol': 'AVAX', 'icon': '🔺'},
    'DOGE': {'name': 'Dogecoin', 'symbol': 'Ð', 'icon': '🐕'},
    'DOT': {'name': 'Polkadot', 'symbol': 'DOT', 'icon': '⚪'},
    'TRX': {'name': 'TRON', 'symbol': 'TRX', 'icon': '⚡'},
    'MATIC': {'name': 'Polygon', 'symbol': 'MATIC', 'icon': '🟣'},
    'LTC': {'name': 'Litecoin', 'symbol': 'Ł', 'icon': '⚡'},
    'SHIB': {'name': 'Shiba Inu', 'symbol': 'SHIB', 'icon': '🐶'},
    'BCH': {'name': 'Bitcoin Cash', 'symbol': 'BCH', 'icon': '💚'},
    'LINK': {'name': 'Chainlink', 'symbol': 'LINK', 'icon': '🔗'},
    'UNI': {'name': 'Uniswap', 'symbol': 'UNI', 'icon': '🦄'},
    'XLM': {'name': 'Stellar', 'symbol': 'XLM', 'icon': '⭐'},
    'ATOM': {'name': 'Cosmos', 'symbol': 'ATOM', 'icon': '⚛️'},
}

# Target currencies for crypto conversion
TARGET_CURRENCIES = {
    'USD': {'name': 'US Dollar', 'symbol': '$', 'flag': '🇺🇸'},
    'EUR': {'name': 'Euro', 'symbol': '€', 'flag': '🇪🇺'},
    'GBP': {'name': 'British Pound', 'symbol': '£', 'flag': '🇬🇧'},
    'JPY': {'name': 'Japanese Yen', 'symbol': '¥', 'flag': '🇯🇵'},
    'CAD': {'name': 'Canadian Dollar', 'symbol': 'C$', 'flag': '🇨🇦'},
    'AUD': {'name': 'Australian Dollar', 'symbol': 'A$', 'flag': '🇦🇺'},
}


def get_crypto_list():
    """
    Get list of available cryptocurrencies
    """
    return [
        {
            'code': code,
            'name': info['name'],
            'symbol': info['symbol'],
            'icon': info['icon']
        }
        for code, info in sorted(CRYPTO_INFO.items())
    ]


def get_target_currencies():
    """
    Get list of target currencies for crypto conversion
    """
    return [
        {
            'code': code,
            'name': info['name'],
            'symbol': info['symbol'],
            'flag': info['flag']
        }
        for code, info in sorted(TARGET_CURRENCIES.items())
    ]


def get_popular_crypto_pairs():
    """
    Get exchange rates for popular crypto pairs
    """
    popular = [
        ('BTC', 'USD'),
        ('ETH', 'USD'),
        ('BNB', 'USD'),
        ('SOL', 'USD'),
        ('XRP', 'USD'),
        ('DOGE', 'USD'),
    ]
    
    results = []
    for crypto, currency in popular:
        rate = get_crypto_exchange_rate(crypto, currency)
        if rate:
            results.append(rate)
    
    return results


if __name__ == "__main__":
    # Test the crypto fetcher
    print("Testing Crypto Fetcher\n")
    
    # Test BTC to USD
    print("BTC to USD:")
    rate = get_crypto_exchange_rate('BTC', 'USD')
    if rate:
        print(f"  {rate['from_crypto']['code']} → {rate['to_currency']['code']}")
        print(f"  Rate: ${rate['exchange_rate']:,.2f}")
        print(f"  Last Updated: {rate['last_refreshed']}")
    
    print("\nETH to USD:")
    rate = get_crypto_exchange_rate('ETH', 'USD')
    if rate:
        print(f"  {rate['from_crypto']['code']} → {rate['to_currency']['code']}")
        print(f"  Rate: ${rate['exchange_rate']:,.2f}")
    
    print("\nAvailable Cryptocurrencies:")
    cryptos = get_crypto_list()
    for crypto in cryptos[:5]:
        print(f"  {crypto['icon']} {crypto['code']} - {crypto['name']} ({crypto['symbol']})")
