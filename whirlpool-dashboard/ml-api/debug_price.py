import asyncio
import httpx
import sys
import os

# Mock the constants
SUPPORTED_TOKENS = ['sol', 'jupsol', 'pengu', 'usdt', 'usdc', 'jup']
TOKEN_ADDRESSES = {
    'sol': 'So11111111111111111111111111111111111111112',
    'jup': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'usdc': 'EPjFWdd5Aufq7p37L39626969696969696969696969',
    'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8En2vBY',
    'jupsol': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
    'pengu': '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv'
}

async def fetch_real_price(token: str) -> float:
    token = token.lower()
    address = TOKEN_ADDRESSES.get(token)
    search_queries = []
    if address:
        search_queries.append(f"https://api.dexscreener.com/latest/dex/search?q={address}")
    search_queries.append(f"https://api.dexscreener.com/latest/dex/search?q={token.upper()}")
    
    async with httpx.AsyncClient() as client:
        for query_url in search_queries:
            try:
                response = await client.get(query_url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    pairs = data.get('pairs', [])
                    if pairs:
                        solana_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                        if solana_pairs:
                            solana_pairs.sort(key=lambda x: x.get('liquidity', {}).get('usd', 0), reverse=True)
                            for pair in solana_pairs[:3]:
                                base_token = pair.get('baseToken', {})
                                quote_token = pair.get('quoteToken', {})
                                base_symbol = base_token.get('symbol', '').lower()
                                quote_symbol = quote_token.get('symbol', '').lower()
                                
                                if base_symbol == token or base_token.get('address') == address:
                                    price = float(pair.get('priceUsd', 0))
                                    if price > 0:
                                        print(f"  [DEBUG] Matched BASE {base_symbol} for {token}")
                                        return price
                                elif quote_symbol == token or quote_token.get('address') == address:
                                    base_price_usd = float(pair.get('priceUsd', 0))
                                    base_price_native = float(pair.get('priceNative', 0))
                                    if base_price_usd > 0 and base_price_native > 0:
                                        result = base_price_usd / base_price_native
                                        print(f"  [DEBUG] Matched QUOTE {quote_symbol} for {token}. Base was {base_symbol}. Math: {base_price_usd} / {base_price_native} = {result}")
                                        return result
            except Exception as e:
                print(f"  [!] Error for {token}: {e}")
    
    if token in ['usdc', 'usdt']:
        return 1.0
    return 0.0

async def main():
    for token in SUPPORTED_TOKENS:
        price = await fetch_real_price(token)
        print(f"{token.upper()}: ${price}")

if __name__ == "__main__":
    asyncio.run(main())
