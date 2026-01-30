
import sys
import os
import requests
import warnings

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from m5_yield_farming.bounds_calculator import BoundsCalculator

# Suppress warnings
warnings.filterwarnings('ignore')

def fetch_crypto_news(token_symbol):
    """
    Fetch news from CryptoPanic API (FREE TIER SAFE).
    Uses multiple API keys with fallback.
    """
    print(f"\nFetching news for {token_symbol} from CryptoPanic...")

    # Multiple API keys with fallback
    API_KEYS = [
        "131c0462cd783cf26c1d9f78ed2da42f4e3d6130",
        "b1df468cd291aba73669559ba56e8f71eb74eb36",
        "62104f2088449001e9f291914c754be8e6971dfc",
        "28d8727e72fc53245dd1996fab56fe326bf40ccf"
    ]
    
    # Map symbols to full names if needed (CryptoPanic often prefers full names or specific IDs)
    currency_map = {
        'sol': 'solana',
        'pengu': 'pengu', # specific ID might be needed if this fails
        'jupsol': 'solana', # fallback to parent chain if token not found
        'jup': 'jupiter-exchange' # guessed, might need verification, defaulting to symbol if not mapped
    }
    
    query_currency = currency_map.get(token_symbol.lower(), token_symbol.lower())

    # Use first working key
    API_KEY = API_KEYS[0]
    
    urls_to_test = [
        # 1. SOL Ticker - RISING Filter - Expecting Fresh?
        (
            "V2 DEV - SOL (Ticker) - RISING",
            f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={API_KEY}&currencies=SOL&filter=rising"
        ),
        # 2. SOL Ticker - HOT Filter
        (
            "V2 DEV - SOL (Ticker) - HOT",
             f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={API_KEY}&currencies=SOL&filter=hot"
        ),
        # 3. PENGU Ticker (Can we find data?)
        (
            "V2 DEV - PENGU (Ticker) - DEFAULT",
            f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={API_KEY}&currencies=PENGU"
        ),
        # 4. JUP Ticker
        (
            "V2 DEV - JUP (Ticker) - DEFAULT",
            f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={API_KEY}&currencies=JUP"
        )
    ]

    headers = {"User-Agent": "Mozilla/5.0"}

    import datetime
    from dateutil import parser
    import pytz

    for label, test_url in urls_to_test:
        print(f"\n  [TEST] {label}")
        print(f"  [>] URL: {test_url.replace(API_KEY, '***')}")
        try:
            response = requests.get(test_url, headers=headers, timeout=10)
            print(f"  [<] Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                print(f"  [+] SUCCESS! Found {len(results)} posts.")
                
                # Check Dates
                now = datetime.datetime.now(pytz.UTC)
                cutoff = now - datetime.timedelta(hours=24)
                
                fresh_count = 0
                for post in results:
                    pub_str = post.get("published_at")
                    if pub_str:
                        pub_date = parser.parse(pub_str)
                        if pub_date >= cutoff:
                            fresh_count += 1
                            
                print(f"      Fresh (last 24h): {fresh_count}")
                
                 # DEBUG: Print the first 5 dates to see what's wrong
                print("      [DEBUG] Recent Post Dates:")
                for post in results[:5]:
                    print(f"      - {post.get('published_at')} | {post.get('title')[:50]}...")
                
                if len(results) > 0:
                     headlines = []
                     for post in results:
                        headlines.append({
                            "title": post.get("title"),
                            "source": post.get("source", {}).get("title"),
                            "published_at": post.get("published_at")
                        })
                     # Store successful headlines but CONTINUE to next test
                     # return [f"{h['title']} ({h['published_at']})" for h in headlines]
            else:
                print(f"  [!] Failed. Response: {response.text[:100]}")
                
        except Exception as e:
            print(f"  [!] Error: {e}")
            
    return []
        
    return []

def main():
    print("="*60)
    print("SENTIMENT MODEL DEBUGGER")
    print("="*60)

    # 1. Initialize Calculator (loads model)
    print("\n[1] Initializing BoundsCalculator (loading model)...")
    try:
        bc = BoundsCalculator()
        if bc.sentiment_model:
            print("  [OK] Sentiment model loaded successfully.")
            print(f"  Type: {type(bc.sentiment_model)}")
        else:
            print("  [FAIL] Sentiment model failed to load (is None).")
            return
    except Exception as e:
        print(f"  [CRITICAL] Initialization failed: {e}")
        return

    # 2. Fetch News
    token = 'SOL'
    print(f"\n[2] Fetching real news for {token}...")
    headlines = fetch_crypto_news(token)
    
    # 3. Test with Real News
    if headlines:
        print(f"\n[3] Analyzing sentiment for {len(headlines)} headlines...")
        try:
            result = bc.get_sentiment_score(headlines)
            print("\n  [RESULT]")
            print(f"  Net Sentiment: {result.get('net_sentiment', 0):.4f} (-1.0 to 1.0)")
            print(f"  Confidence:    {result.get('confidence', 0):.4f}")
        except Exception as e:
            print(f"  [FAIL] Analysis failed: {e}")
    else:
        print("\n[3] No news found. Testing with MOCK headlines...")
        mock_headlines = [
            "Solana soars to new highs as network activity explodes",
            "Major crash expected for crypto markets next week",
            "Solana network offline again, users frustrated"
        ]
        print(f"  Mock Headlines: {mock_headlines}")
        try:
            result = bc.get_sentiment_score(mock_headlines)
            print("\n  [RESULT (MOCK)]")
            print(f"  Net Sentiment: {result.get('net_sentiment', 0):.4f}")
            print(f"  Confidence:    {result.get('confidence', 0):.4f}")
        except Exception as e:
            print(f"  [FAIL] Mock analysis failed: {e}")

if __name__ == "__main__":
    # Force utf-8 for windows console
    sys.stdout.reconfigure(encoding='utf-8')
    main()
