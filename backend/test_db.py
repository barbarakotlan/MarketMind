#!/usr/bin/env python3
"""Test database integration and API endpoints"""

import requests

# Test API endpoints
base_url = 'http://localhost:5001'
print('🧪 Testing API endpoints...')

# Test watchlist endpoints
try:
    response = requests.get(f'{base_url}/watchlist')
    print(f'✅ GET /watchlist: {response.status_code}')
    if response.status_code == 200:
        print(f'   Watchlist: {response.json()}')
except Exception as e:
    print(f'❌ GET /watchlist failed: {e}')

# Test portfolio endpoint
try:
    response = requests.get(f'{base_url}/paper/portfolio')
    print(f'✅ GET /paper/portfolio: {response.status_code}')
    if response.status_code == 200:
        portfolio = response.json()
        print(f'   Portfolio value: ${portfolio.get("total_value", 0):,.2f}')
        print(f'   Cash: ${portfolio.get("cash", 0):,.2f}')
        print(f'   Positions: {len(portfolio.get("positions", []))}')
except Exception as e:
    print(f'❌ GET /paper/portfolio failed: {e}')

# Test analytics endpoint
try:
    response = requests.get(f'{base_url}/paper/analytics')
    print(f'✅ GET /paper/analytics: {response.status_code}')
    if response.status_code == 200:
        analytics = response.json()
        print(f'   Performance data available: {"performance" in analytics}')
        print(f'   History records: {len(analytics.get("history", []))}')
except Exception as e:
    print(f'❌ GET /paper/analytics failed: {e}')

# Test adding to watchlist
try:
    response = requests.post(f'{base_url}/watchlist/AAPL')
    print(f'✅ POST /watchlist/AAPL: {response.status_code}')
    if response.status_code == 201:
        print(f'   Response: {response.json()}')
except Exception as e:
    print(f'❌ POST /watchlist/AAPL failed: {e}')

# Test buy endpoint
try:
    buy_data = {"ticker": "AAPL", "shares": 10}
    response = requests.post(f'{base_url}/paper/buy', json=buy_data)
    print(f'✅ POST /paper/buy: {response.status_code}')
    if response.status_code == 200:
        print(f'   Response: {response.json()}')
except Exception as e:
    print(f'❌ POST /paper/buy failed: {e}')

print('\n🎉 Database integration testing complete!')
