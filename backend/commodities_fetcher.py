"""
Commodities data fetcher using yfinance for commodity ETFs and futures
Provides real-time and historical price data for major commodities
"""
import yfinance as yf
from datetime import datetime, timedelta

# Commodity ETF/Future ticker mappings with metadata
COMMODITIES_INFO = {
    # Energy - Using futures tickers
    'CL=F': {
        'code': 'CL=F',
        'name': 'Crude Oil',
        'full_name': 'WTI Crude Oil Futures',
        'unit': 'USD per barrel',
        'icon': '🛢️',
        'category': 'Energy'
    },
    'BZ=F': {
        'code': 'BZ=F',
        'name': 'Brent Oil',
        'full_name': 'Brent Crude Oil Futures',
        'unit': 'USD per barrel',
        'icon': '⛽',
        'category': 'Energy'
    },
    'NG=F': {
        'code': 'NG=F',
        'name': 'Natural Gas',
        'full_name': 'Natural Gas Futures',
        'unit': 'USD per MMBtu',
        'icon': '🔥',
        'category': 'Energy'
    },
    
    # Metals - Using futures tickers
    'GC=F': {
        'code': 'GC=F',
        'name': 'Gold',
        'full_name': 'Gold Futures',
        'unit': 'USD per troy ounce',
        'icon': '🥇',
        'category': 'Metals'
    },
    'SI=F': {
        'code': 'SI=F',
        'name': 'Silver',
        'full_name': 'Silver Futures',
        'unit': 'USD per troy ounce',
        'icon': '🥈',
        'category': 'Metals'
    },
    'HG=F': {
        'code': 'HG=F',
        'name': 'Copper',
        'full_name': 'Copper Futures',
        'unit': 'USD per pound',
        'icon': '🟤',
        'category': 'Metals'
    },
    'PL=F': {
        'code': 'PL=F',
        'name': 'Platinum',
        'full_name': 'Platinum Futures',
        'unit': 'USD per troy ounce',
        'icon': '⚪',
        'category': 'Metals'
    },
    
    # Agriculture - Using futures tickers
    'ZW=F': {
        'code': 'ZW=F',
        'name': 'Wheat',
        'full_name': 'Wheat Futures',
        'unit': 'USD per bushel',
        'icon': '🌾',
        'category': 'Agriculture'
    },
    'ZC=F': {
        'code': 'ZC=F',
        'name': 'Corn',
        'full_name': 'Corn Futures',
        'unit': 'USD per bushel',
        'icon': '🌽',
        'category': 'Agriculture'
    },
    'KC=F': {
        'code': 'KC=F',
        'name': 'Coffee',
        'full_name': 'Coffee Futures',
        'unit': 'USD per pound',
        'icon': '☕',
        'category': 'Agriculture'
    },
    'SB=F': {
        'code': 'SB=F',
        'name': 'Sugar',
        'full_name': 'Sugar Futures',
        'unit': 'USD per pound',
        'icon': '🍬',
        'category': 'Agriculture'
    },
    'CT=F': {
        'code': 'CT=F',
        'name': 'Cotton',
        'full_name': 'Cotton Futures',
        'unit': 'USD per pound',
        'icon': '🌱',
        'category': 'Agriculture'
    }
}


def get_commodity_price(commodity_code='CL=F', period='5d'):
    """
    Get commodity price data from yfinance
    
    Args:
        commodity_code: Commodity ticker (e.g., 'CL=F' for crude oil)
        period: Time period ('1d', '5d', '1mo', '3mo', '1y')
    
    Returns:
        Dict with commodity price data or None if error
    """
    try:
        # Get commodity info
        commodity_info = COMMODITIES_INFO.get(commodity_code, {})
        
        if not commodity_info:
            return None
        
        # Fetch data from yfinance
        ticker = yf.Ticker(commodity_code)
        hist = ticker.history(period=period)
        
        if hist.empty:
            return None
        
        # Get current and previous prices
        current_price = float(hist['Close'].iloc[-1])
        previous_price = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price
        
        # Calculate changes
        price_change = current_price - previous_price
        price_change_pct = ((price_change / previous_price) * 100) if previous_price != 0 else 0
        
        # Get date
        latest_date = hist.index[-1].strftime('%Y-%m-%d')
        
        # Prepare history data
        history = [
            {
                'date': date.strftime('%Y-%m-%d'),
                'value': float(row['Close'])
            }
            for date, row in hist.iterrows()
        ]
        
        return {
            'code': commodity_code,
            'name': commodity_info['name'],
            'full_name': commodity_info['full_name'],
            'category': commodity_info['category'],
            'icon': commodity_info['icon'],
            'current_price': round(current_price, 2),
            'previous_price': round(previous_price, 2),
            'price_change': round(price_change, 2),
            'price_change_percent': round(price_change_pct, 2),
            'unit': commodity_info['unit'],
            'date': latest_date,
            'history': history
        }
    
    except Exception as e:
        print(f"Error fetching commodity {commodity_code}: {e}")
        return None


def get_all_commodities():
    """
    Get current prices for all commodities
    
    Returns:
        List of commodity data
    """
    commodities = []
    
    for code in COMMODITIES_INFO.keys():
        data = get_commodity_price(code)
        if data:
            commodities.append(data)
    
    return commodities


def get_commodities_by_category():
    """
    Get commodities grouped by category
    
    Returns:
        Dict with categories as keys and lists of commodities as values
    """
    commodities = get_all_commodities()
    
    categorized = {
        'Energy': [],
        'Metals': [],
        'Agriculture': []
    }
    
    for commodity in commodities:
        category = commodity.get('category', 'Other')
        if category in categorized:
            categorized[category].append(commodity)
    
    return categorized


def get_commodity_list():
    """
    Get list of available commodities with metadata
    
    Returns:
        List of commodity info dictionaries
    """
    return [
        {
            'code': code,
            'name': info['name'],
            'full_name': info['full_name'],
            'unit': info['unit'],
            'icon': info['icon'],
            'category': info['category']
        }
        for code, info in COMMODITIES_INFO.items()
    ]


if __name__ == "__main__":
    # Test the commodities fetcher
    print("Testing Commodities Fetcher with yfinance\n")
    
    # Test Crude Oil
    print("Crude Oil (WTI):")
    crude = get_commodity_price('CL=F')
    if crude:
        print(f"  {crude['icon']} {crude['name']}")
        print(f"  Current Price: ${crude['current_price']} {crude['unit']}")
        print(f"  Change: ${crude['price_change']} ({crude['price_change_percent']:+.2f}%)")
        print(f"  Date: {crude['date']}")
    else:
        print("  Failed to fetch data")
    
    print("\nGold:")
    gold = get_commodity_price('GC=F')
    if gold:
        print(f"  {gold['icon']} {gold['name']}")
        print(f"  Current Price: ${gold['current_price']} {gold['unit']}")
        print(f"  Change: ${gold['price_change']} ({gold['price_change_percent']:+.2f}%)")
    else:
        print("  Failed to fetch data")
    
    print("\nAvailable Commodities:")
    commodities = get_commodity_list()
    for comm in commodities[:6]:
        print(f"  {comm['icon']} {comm['name']} ({comm['category']}) - {comm['code']}")
    
    print(f"\nTotal: {len(commodities)} commodities available")
