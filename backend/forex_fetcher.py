"""
Forex (Foreign Exchange) data fetcher using Alpha Vantage
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')


def get_exchange_rate(from_currency='USD', to_currency='EUR'):
    """
    Get real-time exchange rate between two currencies
    
    Args:
        from_currency: Base currency code (e.g., 'USD')
        to_currency: Target currency code (e.g., 'EUR')
    
    Returns:
        Dict with exchange rate information
    """
    try:
        url = 'https://www.alphavantage.co/query'
        params = {
            'function': 'CURRENCY_EXCHANGE_RATE',
            'from_currency': from_currency.upper(),
            'to_currency': to_currency.upper(),
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if 'Realtime Currency Exchange Rate' not in data:
            return None
        
        rate_data = data['Realtime Currency Exchange Rate']
        
        return {
            'from_currency': {
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
        print(f"Error fetching forex data: {e}")
        return None


def get_popular_pairs():
    """
    Get exchange rates for popular currency pairs
    
    Returns:
        List of exchange rate data for major pairs
    """
    major_pairs = [
        ('USD', 'EUR'),  # US Dollar to Euro
        ('USD', 'GBP'),  # US Dollar to British Pound
        ('USD', 'JPY'),  # US Dollar to Japanese Yen
        ('USD', 'CAD'),  # US Dollar to Canadian Dollar
        ('USD', 'AUD'),  # US Dollar to Australian Dollar
        ('EUR', 'GBP'),  # Euro to British Pound
        ('EUR', 'JPY'),  # Euro to Japanese Yen
        ('GBP', 'JPY'),  # British Pound to Japanese Yen
    ]
    
    results = []
    for from_curr, to_curr in major_pairs:
        rate = get_exchange_rate(from_curr, to_curr)
        if rate:
            results.append(rate)
    
    return results


# Common currency codes with full names
CURRENCY_INFO = {
    'USD': {'name': 'US Dollar', 'symbol': '$', 'flag': '🇺🇸'},
    'EUR': {'name': 'Euro', 'symbol': '€', 'flag': '🇪🇺'},
    'GBP': {'name': 'British Pound', 'symbol': '£', 'flag': '🇬🇧'},
    'JPY': {'name': 'Japanese Yen', 'symbol': '¥', 'flag': '🇯🇵'},
    'CAD': {'name': 'Canadian Dollar', 'symbol': 'C$', 'flag': '🇨🇦'},
    'AUD': {'name': 'Australian Dollar', 'symbol': 'A$', 'flag': '🇦🇺'},
    'CHF': {'name': 'Swiss Franc', 'symbol': 'Fr', 'flag': '🇨🇭'},
    'CNY': {'name': 'Chinese Yuan', 'symbol': '¥', 'flag': '🇨🇳'},
    'INR': {'name': 'Indian Rupee', 'symbol': '₹', 'flag': '🇮🇳'},
    'MXN': {'name': 'Mexican Peso', 'symbol': '$', 'flag': '🇲🇽'},
    'BRL': {'name': 'Brazilian Real', 'symbol': 'R$', 'flag': '🇧🇷'},
    'ZAR': {'name': 'South African Rand', 'symbol': 'R', 'flag': '🇿🇦'},
    'KRW': {'name': 'South Korean Won', 'symbol': '₩', 'flag': '🇰🇷'},
    'SGD': {'name': 'Singapore Dollar', 'symbol': 'S$', 'flag': '🇸🇬'},
    'HKD': {'name': 'Hong Kong Dollar', 'symbol': 'HK$', 'flag': '🇭🇰'},
    'NZD': {'name': 'New Zealand Dollar', 'symbol': 'NZ$', 'flag': '🇳🇿'},
    'SEK': {'name': 'Swedish Krona', 'symbol': 'kr', 'flag': '🇸🇪'},
    'NOK': {'name': 'Norwegian Krone', 'symbol': 'kr', 'flag': '🇳🇴'},
    'DKK': {'name': 'Danish Krone', 'symbol': 'kr', 'flag': '🇩🇰'},
    'RUB': {'name': 'Russian Ruble', 'symbol': '₽', 'flag': '🇷🇺'},
}


def get_currency_list():
    """
    Get list of available currencies
    """
    return [
        {
            'code': code,
            'name': info['name'],
            'symbol': info['symbol'],
            'flag': info['flag']
        }
        for code, info in sorted(CURRENCY_INFO.items())
    ]


if __name__ == "__main__":
    # Test the forex fetcher
    print("Testing Forex Fetcher\n")
    
    # Test single exchange rate
    print("USD to EUR:")
    rate = get_exchange_rate('USD', 'EUR')
    if rate:
        print(f"  {rate['from_currency']['code']} → {rate['to_currency']['code']}")
        print(f"  Rate: {rate['exchange_rate']}")
        print(f"  Last Updated: {rate['last_refreshed']}")
    
    print("\nAvailable Currencies:")
    currencies = get_currency_list()
    for curr in currencies[:5]:
        print(f"  {curr['flag']} {curr['code']} - {curr['name']} ({curr['symbol']})")
