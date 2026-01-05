"""
YieldSense ML API - Whirlpools Integration
===========================================
Flask API for ML-powered price predictions and safety analysis.
Designed for integration with the Whirlpools dashboard frontend.

Endpoints:
- GET  /api/health                - Health check
- GET  /api/tokens                - List available tokens
- GET  /api/farming/tokens        - List farming tokens
- GET  /api/farming/bounds/<token> - Price bounds for token
- POST /api/farming/safety        - Full safety analysis
- POST /api/farming/il            - Impermanent loss calculation
- POST /api/farming/quick-analysis - Quick UI analysis
- GET  /api/news/<token>          - News/sentiment for token
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
import os
import sys
import warnings
import requests

warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

app = Flask(__name__)
# Allow CORS for local development ports
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", 
    "http://localhost:3003", "http://localhost:3004", "http://localhost:3005", 
    "http://localhost:3006", "http://localhost:3007", "http://localhost:5173",
    "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002",
    "http://127.0.0.1:3003", "http://127.0.0.1:3004", "http://127.0.0.1:3005",
    "http://127.0.0.1:3006", "http://127.0.0.1:3007", "http://127.0.0.1:5173"
]}})

# Global model instances
volatility_models = {}
sentiment_tokenizer = None
sentiment_model = None
device = None
_bounds_calculator = None

SUPPORTED_TOKENS = ['sol', 'jupsol', 'pengu', 'usdt', 'usdc', 'jup']

# CoinGecko IDs for real-time prices
COINGECKO_IDS = {
    'sol': 'solana',
    'usdt': 'tether',
    'pengu': 'pudgy-penguins',
    'jupsol': 'jupiter-staked-sol',
    'usdc': 'usd-coin',
    'jup': 'jupiter-exchange-solana'
}

# DexScreener Token Addresses (Solana) - Primary price source
TOKEN_ADDRESSES = {
    'sol': 'So11111111111111111111111111111111111111112',
    'jup': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'usdc': 'EPjFWdd5Aufq7p37L39626969696969696969696969',
    'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8En2vBY',
    'jupsol': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
    'pengu': '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv'
}


def replace_nan(obj):
    """Recursively replace NaN/Infinity with None for JSON serialization."""
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, dict):
        return {k: replace_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [replace_nan(item) for item in obj]
    return obj


def load_models():
    """Load all models on startup."""
    global volatility_models, sentiment_tokenizer, sentiment_model, device
    
    import tensorflow as tf
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    
    print("Loading Volatility Models...")
    for token in SUPPORTED_TOKENS:
        model_path = f"models/volatility_{token}.keras"
        if os.path.exists(model_path):
            try:
                volatility_models[token] = tf.keras.models.load_model(model_path)
                print(f"  [OK] {token.upper()}: {model_path}")
            except Exception as e:
                print(f"  [!!] {token.upper()}: Error loading - {e}")
        else:
            print(f"  [--] {token.upper()}: Not found at {model_path}")
    
    print("\nLoading FinBERT Sentiment Model...")
    model_path = "models/finbert_sentiment"
    if os.path.exists(model_path):
        try:
            sentiment_tokenizer = AutoTokenizer.from_pretrained(model_path)
            sentiment_model = AutoModelForSequenceClassification.from_pretrained(model_path)
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            sentiment_model.to(device)
            sentiment_model.eval()
            print(f"  [OK] FinBERT on {device}")
        except Exception as e:
            print(f"  [!!] FinBERT: Error loading - {e}")
    else:
        print(f"  [--] FinBERT: Not found, using fallback")
    
    print(f"\nModels loaded: {len(volatility_models)} volatility")


def get_bounds_calculator():
    """Get or create the bounds calculator."""
    global _bounds_calculator
    if _bounds_calculator is None:
        try:
            from m5_yield_farming.bounds_calculator import BoundsCalculator
            _bounds_calculator = BoundsCalculator(models_dir="models")
            print("  [OK] BoundsCalculator loaded")
        except Exception as e:
            print(f"  [!!] BoundsCalculator error: {e}")
            _bounds_calculator = None
    return _bounds_calculator


def fetch_real_price(token: str) -> float:
    """
    Fetch real-time price with multiple fallbacks.
    Priority: DexScreener -> CoinGecko -> Jupiter -> default
    """
    token = token.lower()
    
    # 1. Try DexScreener (Solana native, fast, less rate limits)
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
                    # Filter for Solana pairs
                    solana_pairs = [p for p in pairs if p.get('chainId') == 'solana']
                    if solana_pairs:
                        # Sort by liquidity (highest first)
                        solana_pairs.sort(key=lambda x: x.get('liquidity', {}).get('usd', 0), reverse=True)
                        
                        for pair in solana_pairs[:3]:
                            base_token = pair.get('baseToken', {})
                            quote_token = pair.get('quoteToken', {})
                            
                            # Case 1: Token is the base token
                            if base_token.get('symbol', '').lower() == token or \
                               base_token.get('address') == address:
                                price = float(pair.get('priceUsd', 0))
                                if price > 0:
                                    print(f"  [+] Fetched {token} from DexScreener (base): ${price}")
                                    return price
                            
                            # Case 2: Token is the quote token
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
    
    # 2. Try CoinGecko as fallback
    try:
        coin_id = COINGECKO_IDS.get(token)
        if coin_id:
            url = "https://api.coingecko.com/api/v3/simple/price"
            params = {"ids": coin_id, "vs_currencies": "usd"}
            response = requests.get(url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                price = float(data[coin_id]['usd'])
                if price > 0:
                    print(f"  [+] Fetched {token} from CoinGecko: ${price}")
                    return price
            elif response.status_code == 429:
                print(f"  [!] CoinGecko rate limit for {token}")
    except Exception as e:
        print(f"  [!] CoinGecko error for {token}: {e}")
    
    # 3. Try Jupiter as tertiary fallback
    try:
        jup_symbol = token.upper()
        if token == 'jupsol': jup_symbol = 'JupSOL'
        
        url = f"https://price.jup.ag/v6/price?ids={jup_symbol}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            price_data = data.get('data', {}).get(jup_symbol)
            if price_data:
                price = float(price_data.get('price', 0))
                if price > 0:
                    print(f"  [+] Fetched {token} from Jupiter: ${price}")
                    return price
    except Exception as e:
        print(f"  [!] Jupiter error for {token}: {e}")
    
    # 4. Last resort for stablecoins
    if token in ['usdc', 'usdt']:
        print(f"  [+] Using default stablecoin price for {token}: 1.0")
        return 1.0
    
    return 0.0


def fetch_token_news(token: str) -> list:
    """Fetch recent news headlines for a token from CryptoPanic or similar."""
    token = token.lower()
    
    # Token to search term mapping
    search_terms = {
        'sol': 'solana',
        'jup': 'jupiter',
        'pengu': 'pudgy penguins',
        'usdt': 'tether',
        'usdc': 'usdc',
        'jupsol': 'jupiter solana'
    }
    
    search = search_terms.get(token, token)
    
    try:
        # Use CryptoPanic API (free tier)
        url = f"https://cryptopanic.com/api/v1/posts/"
        params = {
            "auth_token": "public",  # Free public access
            "currencies": search,
            "filter": "hot",
            "public": "true"
        }
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            headlines = [r.get('title', '') for r in results[:5] if r.get('title')]
            return headlines
    except:
        pass
    
    # Return empty list if API fails
    return []


def analyze_sentiment(headlines: list) -> dict:
    """Analyze sentiment of headlines using FinBERT."""
    global sentiment_model, sentiment_tokenizer, device
    
    if not headlines or sentiment_model is None:
        return {
            'net_sentiment': 0.0,
            'confidence': 0.5,
            'trend': 'neutral',
            'headlines': []
        }
    
    import torch
    
    analyzed = []
    sentiments = []
    
    for headline in headlines[:5]:
        try:
            encoding = sentiment_tokenizer(
                headline, truncation=True, padding='max_length',
                max_length=128, return_tensors='pt'
            )
            
            input_ids = encoding['input_ids'].to(device)
            attention_mask = encoding['attention_mask'].to(device)
            
            with torch.no_grad():
                outputs = sentiment_model(input_ids=input_ids, attention_mask=attention_mask)
                probs = torch.softmax(outputs.logits, dim=1)
                # FinBERT: Positive = 0, Negative = 1, Neutral = 2
                positive = probs[0][0].item()
                negative = probs[0][1].item()
                neutral = probs[0][2].item()
                
                score = positive - negative
                sentiments.append(score)
                
                if score > 0.2:
                    label = 'positive'
                elif score < -0.2:
                    label = 'negative'
                else:
                    label = 'neutral'
                
                analyzed.append({
                    'headline': headline,
                    'sentiment': label,
                    'score': round(score, 3)
                })
        except:
            continue
    
    if not sentiments:
        return {
            'net_sentiment': 0.0,
            'confidence': 0.5,
            'trend': 'neutral',
            'headlines': []
        }
    
    avg_sentiment = np.mean(sentiments)
    if avg_sentiment > 0.15:
        trend = 'bullish'
    elif avg_sentiment < -0.15:
        trend = 'bearish'
    else:
        trend = 'neutral'
    
    return {
        'net_sentiment': round(avg_sentiment, 4),
        'confidence': round(1 - np.std(sentiments) if len(sentiments) > 1 else 0.5, 4),
        'trend': trend,
        'headlines': analyzed
    }


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "models": {
            "volatility": {t: (t in volatility_models) for t in SUPPORTED_TOKENS},
            "sentiment": sentiment_model is not None
        }
    })


@app.route('/api/tokens', methods=['GET'])
def list_tokens():
    """List available tokens."""
    return jsonify({
        "tokens": SUPPORTED_TOKENS,
        "loaded": list(volatility_models.keys())
    })


@app.route('/api/farming/tokens', methods=['GET'])
def farming_tokens():
    """List tokens available for yield farming analysis."""
    return jsonify({
        "success": True,
        "supported_tokens": SUPPORTED_TOKENS,
        "description": "Tokens available for yield farming safety analysis"
    })


@app.route('/api/news/<token>', methods=['GET'])
def get_news(token):
    """Get news and sentiment for a token."""
    token = token.lower()
    
    if token not in SUPPORTED_TOKENS:
        return jsonify({
            "error": f"Token '{token}' not supported",
            "supported_tokens": SUPPORTED_TOKENS
        }), 400
    
    # Fetch news headlines
    headlines = fetch_token_news(token)
    
    # Analyze sentiment
    sentiment = analyze_sentiment(headlines)
    
    return jsonify({
        "success": True,
        "token": token.upper(),
        "news_available": len(headlines) > 0,
        "sentiment": sentiment
    })


@app.route('/api/farming/bounds/<token>', methods=['GET', 'POST'])
def farming_bounds(token):
    """
    Get price prediction bounds for a specific token.
    Uses real-time price from CoinGecko.
    """
    try:
        token = token.lower()
        
        if token not in SUPPORTED_TOKENS:
            return jsonify({
                "error": f"Token '{token}' not supported",
                "supported_tokens": SUPPORTED_TOKENS
            }), 400
        
        calculator = get_bounds_calculator()
        
        # Get optional parameters
        confidence_level = 0.80
        headlines = None
        
        if request.method == 'POST' and request.json:
            confidence_level = request.json.get('confidence_level', 0.80)
            headlines = request.json.get('headlines', None)
        
        if calculator:
            bounds = calculator.calculate_bounds(
                token=token,
                headlines=headlines,
                confidence_level=confidence_level
            )
        else:
            # Fallback: fetch real price and calculate simple bounds
            current_price = fetch_real_price(token)
            if current_price == 0:
                current_price = 100.0  # Default fallback
            
            # Simple volatility estimation
            volatility = 0.05 if token in ['usdt', 'usdc'] else 0.07
            
            bounds = {
                'token': token.upper(),
                'current_price': current_price,
                'predicted_price': current_price,
                'lower_bound': current_price * (1 - volatility),
                'upper_bound': current_price * (1 + volatility),
                'range_width_pct': volatility * 200,
                'safety_score': 70.0,
                'confidence_level': confidence_level,
                'prediction_horizon': '7 days'
            }
        
        return jsonify(replace_nan({
            "success": True,
            "bounds": bounds
        }))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/farming/quick-analysis', methods=['POST'])
def quick_analysis():
    """
    Quick analysis endpoint for the frontend.
    Returns simplified data optimized for UI display.
    Uses real-time prices from CoinGecko.
    """
    try:
        data = request.json
        token_a = data.get('token_a', '').lower()
        token_b = data.get('token_b', '').lower()
        
        if token_a not in SUPPORTED_TOKENS:
            return jsonify({"error": f"Token A '{token_a}' not supported"}), 400
        if token_b not in SUPPORTED_TOKENS:
            return jsonify({"error": f"Token B '{token_b}' not supported"}), 400
        
        # Get optional price overrides from request
        price_a_override = data.get('price_a')
        price_b_override = data.get('price_b')
        
        calculator = get_bounds_calculator()
        
        if calculator:
            # Use the full bounds calculator with optional price overrides
            bounds_a = calculator.calculate_bounds(token=token_a, current_price=price_a_override)
            bounds_b = calculator.calculate_bounds(token=token_b, current_price=price_b_override)
        else:
            # Fallback: fetch real prices directly if not provided
            price_a = price_a_override if price_a_override is not None else fetch_real_price(token_a)
            price_b = price_b_override if price_b_override is not None else fetch_real_price(token_b)
            
            if price_a == 0:
                price_a = 100.0
            if price_b == 0:
                price_b = 1.0
            
            vol_a = 0.005 if token_a in ['usdt', 'usdc'] else 0.07
            vol_b = 0.005 if token_b in ['usdt', 'usdc'] else 0.07
            
            bounds_a = {
                'token': token_a.upper(),
                'current_price': price_a,
                'predicted_price': price_a,
                'lower_bound': price_a * (1 - vol_a),
                'upper_bound': price_a * (1 + vol_a),
                'range_width_pct': vol_a * 200,
                'safety_score': 75.0 if token_a not in ['usdt', 'usdc'] else 95.0
            }
            
            bounds_b = {
                'token': token_b.upper(),
                'current_price': price_b,
                'predicted_price': price_b,
                'lower_bound': price_b * (1 - vol_b),
                'upper_bound': price_b * (1 + vol_b),
                'range_width_pct': vol_b * 200,
                'safety_score': 75.0 if token_b not in ['usdt', 'usdc'] else 95.0
            }
        
        # Calculate overall safety
        avg_safety = (bounds_a['safety_score'] + bounds_b['safety_score']) / 2
        
        # Determine signal
        if avg_safety >= 75:
            signal = "BUY"
            recommendation = "SAFE_TO_FARM"
            message = "✅ Safe to farm. Low volatility expected."
        elif avg_safety >= 50:
            signal = "HOLD"
            recommendation = "MODERATE_FARM"
            message = "⚠️ Moderate risk. Consider smaller position."
        else:
            signal = "AVOID"
            recommendation = "HIGH_RISK_FARM"
            message = "❌ High volatility. Not recommended."
        
        return jsonify(replace_nan({
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
        }))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/farming/safety', methods=['POST'])
def farming_safety():
    """Full safety analysis endpoint."""
    try:
        data = request.json
        token_a = data.get('token_a', '').lower()
        token_b = data.get('token_b', '').lower()
        
        # Use quick-analysis as it now has full functionality
        return quick_analysis()
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/farming/il', methods=['POST'])
def farming_il():
    """Calculate impermanent loss for a token pair."""
    try:
        data = request.json
        token_a = data.get('token_a', '').lower()
        token_b = data.get('token_b', '').lower()
        
        if token_a not in SUPPORTED_TOKENS:
            return jsonify({"error": f"Token A '{token_a}' not supported"}), 400
        if token_b not in SUPPORTED_TOKENS:
            return jsonify({"error": f"Token B '{token_b}' not supported"}), 400
        
        calculator = get_bounds_calculator()
        
        if calculator:
            bounds_a = calculator.calculate_bounds(token=token_a)
            bounds_b = calculator.calculate_bounds(token=token_b)
        else:
            # Simple fallback
            price_a = fetch_real_price(token_a)
            price_b = fetch_real_price(token_b)
            
            bounds_a = {'current_price': price_a, 'lower_bound': price_a * 0.93, 'upper_bound': price_a * 1.07}
            bounds_b = {'current_price': price_b, 'lower_bound': price_b * 0.99, 'upper_bound': price_b * 1.01}
        
        # Simple IL calculation
        price_ratio_change = (bounds_a['upper_bound'] / bounds_a['current_price']) / (bounds_b['upper_bound'] / bounds_b['current_price'])
        il_pct = abs(2 * np.sqrt(price_ratio_change) / (1 + price_ratio_change) - 1) * 100
        
        return jsonify(replace_nan({
            "success": True,
            "token_pair": f"{token_a.upper()}/{token_b.upper()}",
            "impermanent_loss": {
                "expected_il_pct": round(il_pct, 2),
                "worst_case_il_pct": round(il_pct * 1.5, 2),
                "best_case_il_pct": round(il_pct * 0.5, 2)
            },
            "price_bounds": {
                "token_a": {
                    "current": bounds_a['current_price'],
                    "lower": bounds_a['lower_bound'],
                    "upper": bounds_a['upper_bound']
                },
                "token_b": {
                    "current": bounds_b['current_price'],
                    "lower": bounds_b['lower_bound'],
                    "upper": bounds_b['upper_bound']
                }
            }
        }))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    load_models()
    # Pre-load bounds calculator
    get_bounds_calculator()
    
    print("\n" + "=" * 60)
    print("  YIELDSENSE ML API SERVER")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET  /api/health              - Health check")
    print("  GET  /api/tokens              - List tokens")
    print("  GET  /api/farming/tokens      - List farming tokens")
    print("  GET  /api/farming/bounds/<t>  - Price bounds")
    print("  GET  /api/news/<t>            - News & sentiment")
    print("  POST /api/farming/il          - Impermanent loss")
    print("  POST /api/farming/safety      - Full safety analysis")
    print("  POST /api/farming/quick-analysis - Quick UI analysis")
    print(f"\nTokens: {', '.join([t.upper() for t in SUPPORTED_TOKENS])}")
    print("\nStarting server at http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=False)

