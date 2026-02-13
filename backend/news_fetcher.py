import os
import finnhub
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_general_news(category='general', count=15):
    """
    Fetch general market news from the Finnhub API.

    Args:
        category (str): The category of news to fetch (e.g., 'general', 'forex', 'crypto').
        count (int): The number of news articles to return.

    Returns:
        list: A list of news article dictionaries, or an empty list if an error occurs.
    """
    try:
        api_key = os.getenv('FINNHUB_API_KEY')
        if not api_key:
            raise ValueError("FINNHUB_API_KEY not found in environment variables.")

        finnhub_client = finnhub.Client(api_key=api_key)
        news = finnhub_client.general_news(category, min_id=0)
        
        # Return the specified number of articles
        return news[:count]

    except Exception as e:
        print(f"Error fetching news from Finnhub: {e}")
        return []

if __name__ == '__main__':
    # Example usage to test the function
    latest_news = get_general_news()
    if latest_news:
        print(f"Successfully fetched {len(latest_news)} news articles.")
        for article in latest_news:
            print(f"- {article['headline']}")
    else:
        print("Failed to fetch news.")
