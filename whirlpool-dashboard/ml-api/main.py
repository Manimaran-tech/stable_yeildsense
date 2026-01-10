"""
YieldSense ML API - FastAPI Implementation
==========================================
Modern, high-performance API for ML-powered price predictions and safety analysis.
"""
import uvicorn
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np
import os
import sys
import warnings
import requests
import asyncio
from contextlib import asynccontextmanager

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# -------------------------------------------------------------------------
# CONSTANTS & CONFIG
# -------------------------------------------------------------------------
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

SUPPORTED_TOKENS = ['sol', 'jupsol', 'pengu', 'usdt', 'usdc', 'jup']

TOKEN_ADDRESSES = {
    'sol': 'So11111111111111111111111111111111111111112',
    'jup': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'usdc': 'EPjFWdd5Aufq7p37L39626969696969696969696969',
    'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8En2vBY',
    'jupsol': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
    'pengu': '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv'
}

CRYPTOPANIC_API_KEY = "5dfe8871ec3666b5742143616833cb12f4fb682e"

# -------------------------------------------------------------------------
# GLOBAL STATE
# -------------------------------------------------------------------------
volatility_models = {}
sentiment_tokenizer = None
sentiment_model = None
device = None

# -------------------------------------------------------------------------
# MODELS
# -------------------------------------------------------------------------
class QuickAnalysisRequest(BaseModel):
    token_a: str
    token_b: str
    price_a: Optional[float] = None
    price_b: Optional[float] = None

class SafetyAnalysisRequest(BaseModel):
    token_a: str
    token_b: str

class ILRequest(BaseModel):
    token_a: str
    token_b: str

class BoundsRequest(BaseModel):
    confidence_level: Optional[float] = 0.80
    headlines: Optional[List[str]] = None

# -------------------------------------------------------------------------
# LIFECYCLE & HELPERS
# -------------------------------------------------------------------------
def load_models():
    """Load all models on startup."""
    global volatility_models, sentiment_tokenizer, sentiment_model, device
    
    # Import heavy ML libraries only when needed to verify import/env
    import tensorflow as tf
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    
    print("Loading Volatility Models...")
    for token in SUPPORTED_TOKENS:
        model_path = f"models/volatility_{token}.keras"
        if os.path.exists(model_path):
            try:
                # Load with compile=False for speed/safety if inference only
                volatility_models[token] = tf.keras.models.load_model(model_path, compile=False)
                print(f"  [OK] {token.upper()}: {model_path}")
            except Exception as e:
                print(f"  [!!] {token.upper()}: Error loading - {e}")
        else:
            print(f"  [--] {token.upper()}: Not found at {model_path}")
    
    print("\nLoading FinBERT Sentiment Model...")
    print("\nLoading FinBERT Sentiment Model...")
    model_path = "models/finbert_sentiment"
    
    try:
        # Determine source
        model_source = model_path
        if os.path.exists(model_path):
            # Check for LFS pointer
            is_lfs = False
            for fname in ['model.safetensors', 'pytorch_model.bin']:
                fpath = os.path.join(model_path, fname)
                if os.path.exists(fpath) and os.path.getsize(fpath) < 2000:
                    is_lfs = True
                    break
            
            if is_lfs:
                print(f"  [..] Local cache is LFS pointer. Downloading from Hub...")
                model_source = "ProsusAI/finbert"
        else:
            model_source = "ProsusAI/finbert"

        try:
            sentiment_tokenizer = AutoTokenizer.from_pretrained(model_source)
            sentiment_model = AutoModelForSequenceClassification.from_pretrained(model_source)
        except Exception as load_err:
            print(f"  [!!] Failed to load from {model_source}: {load_err}")
            if model_source != "ProsusAI/finbert":
                print("  [..] Attempting fallback download from 'ProsusAI/finbert'...")
                model_source = "ProsusAI/finbert"
                sentiment_tokenizer = AutoTokenizer.from_pretrained(model_source)
                sentiment_model = AutoModelForSequenceClassification.from_pretrained(model_source)
            else:
                raise load_err

        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        sentiment_model.to(device)
        sentiment_model.eval()
        print(f"  [OK] FinBERT loaded from {model_source} on {device}")

    except Exception as e:
        print(f"  [!!] FinBERT: Error loading - {e}")
        print("  [--] Running without sentiment analysis")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("\n" + "=" * 60)
    print("  YIELDSENSE ML API SERVER (FastAPI)")
    print("=" * 60)
    load_models()
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(title="YieldSense ML API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_bounds_calculator():
    """Create a fresh bounds calculator on each call."""
    try:
        from m5_yield_farming.bounds_calculator import BoundsCalculator
        calculator = BoundsCalculator(models_dir="models")
        return calculator
    except Exception as e:
        print(f"  [!!] BoundsCalculator error: {e}")
        return None

def fetch_real_price(token: str) -> float:
    """Fetch real-time price from DexScreener."""
    token = token.lower()
    try:
        address = TOKEN_ADDRESSES.get(token)
        search_queries = []
        if address:
            search_queries.append(f"https://api.dexscreener.com/latest/dex/search?q={address}")
        search_queries.append(f"https://api.dexscreener.com/latest/dex/search?q={token.upper()}")
        
        for query_url in search_queries:
            response = requests.get(query_url, timeout=5)
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
                            
                            if base_token.get('symbol', '').lower() == token or \
                               base_token.get('address') == address:
                                price = float(pair.get('priceUsd', 0))
                                if price > 0:
                                    print(f"  [+] Fetched {token} from DexScreener (base): ${price}")
                                    return price
                            elif quote_token.get('symbol', '').lower() == token or \
                                 quote_token.get('address') == address:
                                base_price_usd = float(pair.get('priceUsd', 0))
                                base_price_native = float(pair.get('priceNative', 0))
                                if base_price_usd > 0 and base_price_native > 0:
                                    price = base_price_usd / base_price_native
                                    print(f"  [+] Fetched {token} from DexScreener (quote): ${price}")
                                    return price
    except Exception as e:
        print(f"  [!] DexScreener error for {token}: {e}")
    
    if token in ['usdc', 'usdt']:
        return 1.0
    if token in ['usdc', 'usdt']:
        return 1.0
    return 0.0

def fetch_crypto_news(token: str) -> List[str]:
    """
    Fetch recent news headlines from CryptoPanic (Developer V2 API).
    """
    token_lower = token.lower()
    
    
    # Hybrid Mapping: Use Tickers where they are known to work better (SOL, JUP),
    # and Slugs where requested/official (PENGU, JupSOL)
    currency_map = {
        'sol': 'SOL',                    # Ticker (Verified: SOL returns data, solana returns 0)
        'jup': 'JUP',                    # Ticker (Verified: JUP returns data)
        'jupsol': 'jupiter-staked-sol',  # Slug (User Request)
        'pengu': 'pudgy-penguins',       # Slug (User Request)
        'usdc': 'USDC',                  # Ticker (Standard)
        'usdt': 'USDT'                   # Ticker (Standard)
    }
    
    # Get mapped currency or default to uppercase token symbol
    query_currency = currency_map.get(token_lower, token.upper())
    
    # V2 Developer Endpoint
    url = (
        "https://cryptopanic.com/api/developer/v2/posts/"
        f"?auth_token={CRYPTOPANIC_API_KEY}"
        f"&currencies={query_currency}"
        "&kind=news"
        "&public=true"
    )
    
    try:
        # User-Agent is critical
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        print(f"  [>] Fetching news for {token_lower} ({query_currency})...")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            # --- 24h (Soft) FILTERING LOGIC ---
            import datetime
            
            # Use UTC for strict comparison
            now = datetime.datetime.now(datetime.timezone.utc)
            cutoff_24h = now - datetime.timedelta(hours=24)
            cutoff_72h = now - datetime.timedelta(hours=72)
            
            fresh_headlines = []
            older_headlines = []
            
            for post in results:
                title = post.get('title')
                pub_str = post.get('published_at') # e.g. "2026-01-06T16:40:00Z"
                
                if not title or not pub_str:
                    continue
                    
                try:
                    # Clean 'Z' for ISO compatible parsing if needed
                    if pub_str.endswith('Z'):
                        pub_str = pub_str[:-1] + '+00:00'
                        
                    pub_date = datetime.datetime.fromisoformat(pub_str)
                    
                    if pub_date >= cutoff_24h:
                        fresh_headlines.append(title)
                    elif pub_date >= cutoff_72h:
                        older_headlines.append(title)
                except Exception as parse_err:
                    print(f"  [!] Date parsing failed for '{pub_str}': {parse_err}")
                    continue

            # STRATEGY: Prefer Fresh > Then Older > Then Raw Fallback
            if fresh_headlines:
                print(f"  [+] News for {token_lower}: Found {len(fresh_headlines)} FRESH headlines (<24h).")
                return fresh_headlines
            elif older_headlines:
                print(f"  [~] News for {token_lower}: No fresh news. Returning {len(older_headlines)} OLDER headlines (<72h).")
                return older_headlines
            else:
                # Fallback: Just give the top 5 raw results if we have them
                print(f"  [-] News for {token_lower}: No recent news. Returning top 5 raw posts as fallback.")
                raw_headlines = [p['title'] for p in results[:5] if p.get('title')]
                return raw_headlines
        else:
            # Suppress verbose HTML errors
            if "<html" in response.text[:50].lower():
                print(f"  [!] News API unavailable (Status {response.status_code}) - likely network blocked.")
            else:
                print(f"  [!] CryptoPanic API Error {response.status_code}: {response.text[:100]}")
            return []
    except Exception as e:
        print(f"  [!] News fetch error for {token_lower}: {e}")
        return []

def replace_nan(obj):
    """Recursively replace NaN/Infinity with None."""
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: replace_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan(item) for item in obj]
    return obj

# -------------------------------------------------------------------------
# ENDPOINTS
# -------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "models": {
            "volatility": {t: (t in volatility_models) for t in SUPPORTED_TOKENS},
            "sentiment": sentiment_model is not None
        }
    }

@app.get("/api/tokens")
async def list_tokens():
    return {
        "tokens": SUPPORTED_TOKENS,
        "loaded": list(volatility_models.keys())
    }

@app.get("/api/farming/tokens")
async def farming_tokens():
    return {
        "success": True,
        "supported_tokens": SUPPORTED_TOKENS,
        "description": "Tokens available for yield farming safety analysis"
    }

@app.post("/api/farming/quick-analysis")
async def quick_analysis(req: QuickAnalysisRequest):
    token_a = req.token_a.lower()
    token_b = req.token_b.lower()
    
    if token_a not in SUPPORTED_TOKENS:
        raise HTTPException(status_code=400, detail=f"Token A '{token_a}' not supported")
    if token_b not in SUPPORTED_TOKENS:
        raise HTTPException(status_code=400, detail=f"Token B '{token_b}' not supported")
    
    calculator = get_bounds_calculator()
    
    if calculator:
        # Fetch news for sentiment analysis
        headlines_a = fetch_crypto_news(token_a)
        headlines_b = fetch_crypto_news(token_b)
        
        # Calculate bounds with sentiment
        bounds_a = calculator.calculate_bounds(token=token_a, current_price=req.price_a, headlines=headlines_a)
        bounds_b = calculator.calculate_bounds(token=token_b, current_price=req.price_b, headlines=headlines_b)
    else:
        # Fallback
        price_a = req.price_a if req.price_a is not None else fetch_real_price(token_a)
        price_b = req.price_b if req.price_b is not None else fetch_real_price(token_b)
        
        if price_a == 0: price_a = 100.0
        if price_b == 0: price_b = 1.0
        
        vol_a = 0.005 if token_a in ['usdt', 'usdc'] else 0.07
        vol_b = 0.005 if token_b in ['usdt', 'usdc'] else 0.07
        
        bounds_a = {
            'token': token_a.upper(), 'current_price': price_a, 'predicted_price': price_a,
            'lower_bound': price_a * (1 - vol_a), 'upper_bound': price_a * (1 + vol_a),
            'range_width_pct': vol_a * 200, 'safety_score': 75.0 if token_a not in ['usdt', 'usdc'] else 95.0
        }
        bounds_b = {
            'token': token_b.upper(), 'current_price': price_b, 'predicted_price': price_b,
            'lower_bound': price_b * (1 - vol_b), 'upper_bound': price_b * (1 + vol_b),
            'range_width_pct': vol_b * 200, 'safety_score': 75.0 if token_b not in ['usdt', 'usdc'] else 95.0
        }
    
    # Calculate overall safety
    avg_safety = (bounds_a['safety_score'] + bounds_b['safety_score']) / 2
    
    if avg_safety >= 75:
        signal, recommendation, message = "BUY", "SAFE_TO_FARM", "✅ Safe to farm. Low volatility expected."
    elif avg_safety >= 50:
        signal, recommendation, message = "HOLD", "MODERATE_FARM", "⚠️ Moderate risk. Consider smaller position."
    else:
        signal, recommendation, message = "AVOID", "HIGH_RISK_FARM", "❌ High volatility. Not recommended."
    
    return replace_nan({
        "success": True,
        "token_a": {
            "symbol": bounds_a['token'],
            "current_price": bounds_a['current_price'],
            "predicted_price": bounds_a.get('predicted_price', bounds_a['current_price']),
            "lower_bound": bounds_a['lower_bound'],
            "upper_bound": bounds_a['upper_bound'],
            "range_width_pct": bounds_a.get('range_width_pct', 7.0),
            "safety_score": bounds_a['safety_score']
        },
        "token_b": {
            "symbol": bounds_b['token'],
            "current_price": bounds_b['current_price'],
            "predicted_price": bounds_b.get('predicted_price', bounds_b['current_price']),
            "lower_bound": bounds_b['lower_bound'],
            "upper_bound": bounds_b['upper_bound'],
            "range_width_pct": bounds_b.get('range_width_pct', 1.0),
            "safety_score": bounds_b['safety_score']
        },
        "overall": {
            "safety_score": round(avg_safety, 1),
            "recommendation": recommendation,
            "signal": signal,
            "message": message
        }
    })

def analyze_sentiment_detailed(headlines: List[str]) -> Dict[str, Any]:
    """
    Detailed sentiment analysis returning per-headline scores.
    """
    if not headlines or sentiment_model is None:
        return {
            "net_sentiment": 0.0,
            "confidence": 0.0,
            "trend": "neutral",
            "headlines": []
        }
        
    import torch
    
    results = []
    scores = []
    
    # Process max 10 headlines
    for headline in headlines[:10]:
        try:
            inputs = sentiment_tokenizer(headline, return_tensors="pt", truncation=True, padding=True, max_length=512)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = sentiment_model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                
            # FinBERT labels: [positive, negative, neutral] usually, but confirm model specific
            # ProsusAI/finbert labels: 0: positive, 1: negative, 2: neutral
            pos = probs[0][0].item()
            neg = probs[0][1].item()
            neu = probs[0][2].item()
            
            score = pos - neg
            scores.append(score)
            
            if score > 0.1:
                label = "positive"
            elif score < -0.1:
                label = "negative"
            else:
                label = "neutral"
                
            results.append({
                "headline": headline,
                "sentiment": label,
                "score": round(score, 4)
            })
        except Exception as e:
            print(f"  [!] Sentiment error for headline: {e}")
            continue
            
    if not scores:
        return {
            "net_sentiment": 0.0,
            "confidence": 0.0,
            "trend": "neutral",
            "headlines": []
        }
        
    net_score = np.mean(scores)
    
    if net_score > 0.15:
        trend = "bullish"
    elif net_score < -0.15:
        trend = "bearish"
    else:
        trend = "neutral"
        
    return {
        "net_sentiment": round(net_score, 4),
        "confidence": round(1.0 - np.std(scores) if len(scores) > 1 else 0.8, 4),
        "trend": trend,
        "headlines": results
    }

@app.get("/api/news/{token}")
async def get_token_news(token: str):
    """
    Get news and sentiment for a specific token.
    """
    token = token.lower()
    
    # 1. Fetch News
    headlines = fetch_crypto_news(token)
    
    if not headlines:
        return {
            "success": True,
            "token": token.upper(),
            "news_available": False,
            "sentiment": {
                "net_sentiment": 0,
                "confidence": 0,
                "trend": "neutral",
                "headlines": []
            }
        }
        
    # 2. Analyze Sentiment
    sentiment_data = analyze_sentiment_detailed(headlines)
    
    return {
        "success": True,
        "token": token.upper(),
        "news_available": True,
        "sentiment": sentiment_data
    }

# -------------------------------------------------------------------------
# STAKING APY ENDPOINTS
# -------------------------------------------------------------------------
from staking_api import get_staking_apy, get_token_staking_apy, is_lst_token, calculate_combined_yield

@app.get("/api/staking/apy")
async def staking_apy():
    """
    Get current staking APY for all supported LSTs.
    Returns real-time staking yields for JupSOL, mSOL, jitoSOL, bSOL.
    """
    try:
        data = await get_staking_apy()
        return {
            "success": True,
            **data
        }
    except Exception as e:
        print(f"[!] Staking APY error: {e}")
        return {
            "success": False,
            "error": str(e),
            "lsts": {}
        }

@app.get("/api/staking/apy/{token}")
async def token_staking_apy(token: str):
    """
    Get staking APY for a specific LST token.
    Returns null if token is not an LST.
    """
    try:
        if not is_lst_token(token):
            return {
                "success": True,
                "is_lst": False,
                "token": token.upper(),
                "apy": None
            }
        
        apy_data = await get_token_staking_apy(token)
        return {
            "success": True,
            "is_lst": True,
            "token": token.upper(),
            "apy": apy_data
        }
    except Exception as e:
        print(f"[!] Token staking APY error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/staking/combined-yield")
async def combined_yield(staking_apy: float = Body(...), lp_apy: float = Body(...)):
    """
    Calculate combined yield from staking + LP.
    """
    try:
        result = calculate_combined_yield(staking_apy, lp_apy)
        return {
            "success": True,
            **result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

