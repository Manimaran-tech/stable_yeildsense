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
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge
import os
import sys
import warnings
import httpx
import asyncio
import redis.asyncio as redis
import onnxruntime as ort
import json
from contextlib import asynccontextmanager
from transformers import AutoTokenizer

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

CRYPTOPANIC_API_KEYS = [
    "131c0462cd783cf26c1d9f78ed2da42f4e3d6130",
    "b1df468cd291aba73669559ba56e8f71eb74eb36",
    "62104f2088449001e9f291914c754be8e6971dfc",
    "28d8727e72fc53245dd1996fab56fe326bf40ccf"
]
CRYPTOPANIC_KEY_INDEX = 0  # Current key index, rotates on failure


# -------------------------------------------------------------------------
# GLOBAL STATE
# -------------------------------------------------------------------------
volatility_sessions = {}
sentiment_session = None
redis_client = None
tokenizer = None
calculator = None
device = "cpu"

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
async def load_models():
    """Load all models as ONNX sessions on startup."""
    global volatility_sessions, sentiment_session, redis_client
    
    # Initialize Redis
    try:
        redis_client = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
        await redis_client.ping()
        print("[OK] Redis connected")
    except Exception as e:
        print(f"[!!] Redis connection failed: {e}. Running without cache.")
        redis_client = None

    print("Loading ONNX Volatility Models...")
    onnx_dir = "models/onnx"
    
    # Load Tokenizer
    global tokenizer
    try:
        print("Loading FinBERT Tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
    except Exception as e:
        print(f"Tokenization loading error: {e}")
    for token in SUPPORTED_TOKENS:
        model_path = os.path.join(onnx_dir, f"volatility_{token}.onnx")
        if os.path.exists(model_path):
            try:
                volatility_sessions[token] = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
                print(f"  [OK] {token.upper()}: {model_path}")
            except Exception as e:
                print(f"  [!!] {token.upper()}: Error loading ONNX - {e}")

    print("\nLoading ONNX FinBERT Model...")
    finbert_onnx = os.path.join(onnx_dir, "finbert.onnx")
    if os.path.exists(finbert_onnx):
        try:
            sentiment_session = ort.InferenceSession(finbert_onnx, providers=['CPUExecutionProvider'])
            print(f"  [OK] FinBERT loaded from {finbert_onnx}")
        except Exception as e:
            print(f"  [!!] FinBERT: Error loading ONNX - {e}")
    else:
        print(f"  [--] FinBERT ONNX not found at {finbert_onnx}")

    # Initialize BoundsCalculator (Source of Truth)
    global calculator
    try:
        from m5_yield_farming.bounds_calculator import BoundsCalculator
        calculator = BoundsCalculator(models_dir="models")
        print("[OK] BoundsCalculator initialized")
    except Exception as e:
        print(f"[!!] BoundsCalculator init failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("\n" + "=" * 60)
    print("  YIELDSENSE ML API SERVER (FastAPI) - ONNX EDITION")
    print("=" * 60)
    await load_models()
    yield
    # Shutdown
    if redis_client:
        await redis_client.close()
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

async def fetch_real_price(token: str) -> float:
    """Fetch real-time price from DexScreener using async httpx."""
    token = token.lower()
    
    # 1. Stablecoin shortcut (guarantees accuracy)
    if token in ['usdc', 'usdt']:
        return 1.0
        
    try:
        address = TOKEN_ADDRESSES.get(token)
        search_queries = []
        
        # 2. Priority: Specific token address endpoint (guaranteed match)
        if address:
            search_queries.append(f"https://api.dexscreener.com/latest/dex/tokens/{address}")
            
        # 3. Fallback: Search by symbol
        search_queries.append(f"https://api.dexscreener.com/latest/dex/search?q={token.upper()}")
        
        async with httpx.AsyncClient() as client:
            for query_url in search_queries:
                response = await client.get(query_url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    pairs = data.get('pairs', [])
                    if pairs:
                        # Filter for Solana pairs
                        solana_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                        if solana_pairs:
                            # Sort by liquidity
                            solana_pairs.sort(key=lambda x: x.get('liquidity', {}).get('usd', 0), reverse=True)
                            
                            for pair in solana_pairs[:3]:
                                base_token = pair.get('baseToken', {})
                                base_address = base_token.get('address')
                                base_symbol = base_token.get('symbol', '').lower()
                                
                                # CRITICAL: Ensure we only return price if the token is the BASE token
                                # Quote token pricing via priceNative is too volatile to rely on here
                                if base_symbol == token or (address and base_address == address):
                                    price = float(pair.get('priceUsd', 0))
                                    if price > 0:
                                        return price
    except Exception as e:
        print(f"  [!] DexScreener error for {token}: {e}")
    
    return 0.0

async def fetch_crypto_news(token: str) -> List[str]:
    """Fetch recent news headlines from CryptoPanic using async httpx."""
    global CRYPTOPANIC_KEY_INDEX
    token_lower = token.lower()
    currency_map = {
        'sol': 'SOL', 
        'jup': 'JUP', 
        'jupsol': 'jupiter-staked-sol', 
        'pengu': 'PENGU',
        'pudgy-penguins': 'PENGU',
        'usdc': 'USD',
        'usdt': 'USD'
    }
    query_currency = currency_map.get(token_lower, token.upper())
    
    num_keys = len(CRYPTOPANIC_API_KEYS)
    async with httpx.AsyncClient() as client:
        for _ in range(num_keys):
            current_key = CRYPTOPANIC_API_KEYS[CRYPTOPANIC_KEY_INDEX]
            url = f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={current_key}&currencies={query_currency}&kind=news&public=true"
            try:
                response = await client.get(url, timeout=5)
                if response.status_code in [401, 403, 429]:
                    CRYPTOPANIC_KEY_INDEX = (CRYPTOPANIC_KEY_INDEX + 1) % num_keys
                    continue
                if response.status_code == 200:
                    data = response.json()
                    return [post.get('title') for post in data.get('results', []) if post.get('title')][:10]
            except Exception as e:
                CRYPTOPANIC_KEY_INDEX = (CRYPTOPANIC_KEY_INDEX + 1) % num_keys
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
            "volatility": {t: (t in volatility_sessions) for t in SUPPORTED_TOKENS},
            "sentiment": sentiment_session is not None
        },
        "cache": redis_client is not None
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

def inject_dp_noise(value: float, scale: float = 0.002) -> float:
    """Inject Laplace/Gaussian noise for differential privacy to prevent model extraction."""
    return value + np.random.normal(0, scale)

async def check_adversarial_canary(token_a, token_b):
    """Detect high-frequency probing attacks using Redis."""
    if not redis_client: return False
    
    key = f"canary:probe:{token_a}:{token_b}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 10) # 10s window
    
    return count > 20 # Threshold for 'suspicious' activity

@app.post("/api/farming/quick-analysis")
async def quick_analysis(req: QuickAnalysisRequest):
    # 0. Canary & Boundary Validation
    if await check_adversarial_canary(req.token_a, req.token_b):
            print(f"[!] Adversarial Probe Detected for {req.token_a}/{req.token_b}")
            # Could return throttled or noisy response
            
    # Input Validation
    for p in [req.price_a, req.price_b]:
        if p is not None and (p <= 0 or p > 1_000_000_000 or np.isnan(p)):
            raise HTTPException(status_code=400, detail="Anomalous price input detected")

    token_a = req.token_a.lower()
    token_b = req.token_b.lower()
    
    # 1. Try Cache
    if redis_client:
        cache_key = f"analysis:{token_a}:{token_b}"
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)

    if token_a not in SUPPORTED_TOKENS or token_b not in SUPPORTED_TOKENS:
        raise HTTPException(status_code=400, detail="Unsupported token(s)")
    
    # 2. Parallel Fetch
    # Use a helper to return value if price is provided, else fetch
    async def get_price(t, p):
        return p if p is not None else await fetch_real_price(t)

    headlines_a, headlines_b, price_a, price_b = await asyncio.gather(
        fetch_crypto_news(token_a),
        fetch_crypto_news(token_b),
        get_price(token_a, req.price_a),
        get_price(token_b, req.price_b)
    )
    
    # Use real BoundsCalculator if available
    if calculator:
        try:
            # Run in thread pool to avoid blocking async loop since calculator is sync
            loop = asyncio.get_event_loop()
            bounds_a = await loop.run_in_executor(None, calculator.calculate_bounds, token_a, price_a, None, headlines_a)
            bounds_b = await loop.run_in_executor(None, calculator.calculate_bounds, token_b, price_b, None, headlines_b)
            
            # Ensure symbol fields exist for UI
            bounds_a['symbol'] = token_a.upper()
            bounds_b['symbol'] = token_b.upper()
        except Exception as e:
            print(f"[!!] Bounds calculation fallback: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    else:
         raise HTTPException(status_code=503, detail="ML Models not initialized")

    # Apply Differential Privacy Noise to safety score for privacy-focused users
    for b in [bounds_a, bounds_b]:
        b['safety_score'] = inject_dp_noise(b['safety_score'], 0.1)

    avg_safety = (bounds_a['safety_score'] + bounds_b['safety_score']) / 2
    
    response = replace_nan({
        "success": True,
        "token_a": bounds_a,
        "token_b": bounds_b,
        "overall": {
            "safety_score": round(avg_safety, 1),
            "recommendation": "SAFE_TO_FARM" if avg_safety >= 75 else "MODERATE_FARM" if avg_safety >= 50 else "RISKY_AVOID",
            "signal": "BUY" if avg_safety >= 75 else "HOLD" if avg_safety >= 50 else "SELL",
            "message": "Analysis powered by LSTM + FinBERT (YieldSense v2)"
        }
    })
    
    # 3. Save to Cache (60s)
    if redis_client:
        await redis_client.setex(cache_key, 60, json.dumps(response))
        
    return response

async def analyze_sentiment_detailed(headlines: List[str]) -> Dict[str, Any]:
    """Analyze sentiment using ONNX FinBERT."""
    if not headlines or sentiment_session is None:
        return {"net_sentiment": 0.0, "confidence": 0.0, "trend": "neutral", "headlines": []}
    
    # Use only first 5 for speed
    results = []
    scores = []
    
    # Note: Proper tokenization should happen here. 
    # For now, we simulate the input tensor preparation to show ONNX usage.
    # In a real scenario, we'd use the same tokenizer as conversion.
    
    for headline in headlines[:5]:
        if tokenizer:
            encoded = tokenizer(headline, padding='max_length', truncation=True, max_length=128, return_tensors='np')
            input_ids = encoded['input_ids']
            attention_mask = encoded['attention_mask']
        else:
            input_ids = np.zeros((1, 128), dtype=np.int64)
            attention_mask = np.ones((1, 128), dtype=np.int64)
            
        ort_inputs = {
            'input_ids': input_ids,
            'attention_mask': attention_mask
        }
        ort_outs = sentiment_session.run(None, ort_inputs)
        logits = ort_outs[0]
        
        # Softmax and score logic
        probs = np.exp(logits) / np.sum(np.exp(logits), axis=-1, keepdims=True)
        score = float(probs[0][0] - probs[0][1]) # Pos - Neg
        scores.append(score)
        results.append({"headline": headline, "score": score})
        
    net_score = np.mean(scores)
    return {
        "net_sentiment": round(net_score, 4),
        "confidence": 0.8,
        "trend": "bullish" if net_score > 0.1 else "neutral",
        "headlines": results
    }

@app.get("/api/news/{token}")
async def get_token_news(token: str):
    """
    Get news and sentiment for a specific token.
    """
    token = token.lower()
    
    # 1. Fetch News
    headlines = await fetch_crypto_news(token)
    
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
    sentiment_data = await analyze_sentiment_detailed(headlines)
    
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

