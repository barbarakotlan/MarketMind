#!/usr/bin/env python3
"""
Test script for autocomplete functionality
"""
import requests

def test_autocomplete():
    """Test the autocomplete endpoint"""
    base_url = "http://127.0.0.1:5001"
    
    # Test cases
    test_queries = ["AA", "APP", "GOO", "MIC"]
    
    print("Testing autocomplete endpoint...")
    print("=" * 50)
    
    for query in test_queries:
        try:
            response = requests.get(f"{base_url}/search-symbols", params={"q": query})
            
            if response.status_code == 200:
                data = response.json()
                print(f"\nQuery: '{query}'")
                print(f"Results: {len(data)} suggestions")
                for i, stock in enumerate(data[:3], 1):
                    print(f"  {i}. {stock['symbol']} - {stock['name']}")
            else:
                print(f"\nQuery: '{query}' - Error: {response.status_code}")
                print(f"  Response: {response.text}")
                
        except Exception as e:
            print(f"\nQuery: '{query}' - Exception: {e}")
    
    print("\n" + "=" * 50)
    print("Test complete!")

if __name__ == "__main__":
    test_autocomplete()
