"""
Price Bounds Calculator
=======================
Calculates realistic price prediction bounds for tokens using LSTM + sentiment.
Uses real-time prices and historical data for accurate predictions.
"""
import numpy as np
import pandas as pd
import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Tuple
import warnings
warnings.filterwarnings('ignore')

# Suppress TensorFlow logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf


class BoundsCalculator:
    """
    Calculates price prediction bounds using LSTM models and sentiment analysis.
    Uses calibrated parameters for realistic range estimation.
    """
    
    # Token-specific max sentiment impact (calibrated)
    SENTIMENT_IMPACT = {
        'sol': 0.02,      # 2% for established tokens  
        'jup': 0.02,
        'usdt': 0.005,    # 0.5% for stablecoins
        'usdc': 0.005,
        'jupsol': 0.02,
        'pengu': 0.03     # 3% for newer tokens (reduced from 6%)
    }
    
    # Z-scores for confidence intervals
    Z_SCORES = {
        0.68: 1.00,
        0.80: 1.28,   # Default
        0.90: 1.645,
        0.95: 1.96
    }
    
    # Token-specific range multipliers (calibrated from historical data)
    # These scale the raw volatility to match actual observed weekly ranges
    # Tuned to capture 100% of historical price movements
    RANGE_MULTIPLIERS = {
        'sol': 0.50,       # SOL: increased from 0.40 to add 1% buffer
        'jup': 0.50,       # JUP: conservative for newer data
        'usdt': 1.0,       # USDT: keep as-is (already stable)
        'usdc': 1.0,
        'jupsol': 0.48,    # JUPSOL: increased from 0.40 to add buffer
        'pengu': 0.35      # PENGU: already capturing well
    }
    
    # DexScreener Token Addresses (Solana)
    TOKEN_ADDRESSES = {
        'sol': 'So11111111111111111111111111111111111111112',
        'jup': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        'usdc': 'EPjFWdd5Aufq7p37L39626969696969696969696969',
        'usdt': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8En2vBY',
        'jupsol': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
        'pengu': '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv'
    }
    
    def __init__(self, models_dir: str = "models"):
        """Initialize with volatility models directory."""
        print(f"DEBUG: BoundsCalculator init from {__file__}", flush=True)
        self.models_dir = models_dir
        self.volatility_models = {}
        self.sentiment_model = None
        self.sentiment_tokenizer = None
        self._last_24h_change = 0.0  # Initialize to prevent stale values across tokens
        self._load_models()
    
    def _load_models(self):
        """Load volatility models for all supported tokens."""
        supported_tokens = ['sol', 'jupsol', 'pengu', 'usdt', 'jup']
        
        for token in supported_tokens:
            model_path = os.path.join(self.models_dir, f"volatility_{token}.keras")
            if os.path.exists(model_path):
                try:
                    self.volatility_models[token] = tf.keras.models.load_model(model_path)
                except Exception as e:
                    print(f"Warning: Could not load {token} model: {e}")
        
        # Load sentiment model
        # Load sentiment model
        sentiment_path = os.path.join(self.models_dir, "finbert_sentiment")
        
        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            
            # Primary attempt: Load from local path if it looks valid
            # If it's just an LFS pointer (very small), skip straight to download
            model_source = sentiment_path
            if os.path.exists(sentiment_path):
                # Simple check: if model.safetensors or pytorch_model.bin is too small (<1KB), it's likely an LFS pointer
                is_lfs_pointer = False
                for fname in ['model.safetensors', 'pytorch_model.bin']:
                    fpath = os.path.join(sentiment_path, fname)
                    if os.path.exists(fpath) and os.path.getsize(fpath) < 2000:
                        is_lfs_pointer = True
                        break
                
                if is_lfs_pointer:
                    print(f"DEBUG: Local model at {sentiment_path} appears to be an LFS pointer. Downloading from Hub...")
                    model_source = "ProsusAI/finbert"
            else:
                model_source = "ProsusAI/finbert"

            try:
                self.sentiment_tokenizer = AutoTokenizer.from_pretrained(model_source)
                self.sentiment_model = AutoModelForSequenceClassification.from_pretrained(model_source)
            except Exception as load_err:
                print(f"Warning: Failed to load from {model_source}: {load_err}")
                if model_source != "ProsusAI/finbert":
                    print("Attempting fallback download from 'ProsusAI/finbert'...")
                    self.sentiment_tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
                    self.sentiment_model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
                else:
                    raise load_err

            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self.sentiment_model.to(self.device)
            self.sentiment_model.eval()
            print(f"DEBUG: Sentiment model loaded successfully from {model_source if 'ProsusAI' in model_source else 'local cache'}")
        except Exception as e:
            print(f"Warning: Could not load sentiment model: {e}")
    
    def fetch_current_price(self, token: str) -> float:
        """
        Fetch real-time price from DexScreener (Solana native, fast, reliable).
        """
        token = token.lower()
        
        # 0. Stablecoin shortcut
        if token in ['usdc', 'usdt']:
            return 1.0
            
        # 1. Try DexScreener
        try:
            address = self.TOKEN_ADDRESSES.get(token)
            search_queries = []
            
            # Use direct token endpoint if address known
            if address:
                search_queries.append(f"https://api.dexscreener.com/latest/dex/tokens/{address}")
            
            # Fallback to general search
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
                                base_symbol = base_token.get('symbol', '').lower()
                                base_address = base_token.get('address')
                                
                                # Verify match (must be BASE token)
                                if base_symbol == token or (address and base_address == address):
                                    price = float(pair.get('priceUsd', 0))
                                    if price > 0:
                                        self._last_24h_change = float(pair.get('priceChange', {}).get('h24', 0.0))
                                        print(f"  [+] Fetched {token} price: ${price}")
                                        return price
        except Exception as e:
            print(f"  [!] DexScreener error for {token}: {e}")
            
        return 0.0
    
    def fetch_historical_data(self, token: str, days: int = 30) -> pd.DataFrame:
        """
        Fetch historical price data from local parquet files.
        CoinGecko removed due to rate limits - using local data only.
        """
        token = token.lower()
        
        # Search in multiple possible locations for parquet files
        possible_paths = [
            f"data/processed/{token}_aligned.parquet",
            os.path.join(os.path.dirname(__file__), f"../../../../processed/{token}_aligned.parquet"),
            os.path.join(os.path.dirname(__file__), f"../../data/processed/{token}_aligned.parquet"),
            os.path.join(os.path.dirname(__file__), f"../../../data/processed/{token}_aligned.parquet"),
            os.path.join(os.path.dirname(__file__), f"../../../../ml models and appraoch/data/processed/{token}_aligned.parquet"),
            f"../ml models and appraoch/data/processed/{token}_aligned.parquet",
            f"../../ml models and appraoch/data/processed/{token}_aligned.parquet",
        ]
        
        for parquet_path in possible_paths:
            if os.path.exists(parquet_path):
                try:
                    df = pd.read_parquet(parquet_path)
                    if len(df) > days:
                        df = df.iloc[-days:]
                    return df
                except Exception as e:
                    print(f"Error reading {parquet_path}: {e}")
                    continue
        
        # Return empty DataFrame if no local data found
        return pd.DataFrame()
    
    def get_lstm_prediction(self, token: str, historical_data: pd.DataFrame) -> Dict:
        """Get LSTM model prediction for token."""
        token = token.lower()
        model = self.volatility_models.get(token)
        
        if model is None or len(historical_data) < 30:
            # Return neutral prediction
            current_price = float(historical_data['price'].iloc[-1]) if len(historical_data) > 0 else 100.0
            return {
                'expected_return': 0.0,
                'volatility': 0.05,
                'downside_prob': 0.5,
                'current_price': current_price
            }
        
        # Prepare sequence
        df = historical_data.copy()
        df['price_ret'] = df['price'].pct_change().fillna(0)
        df['tvl_ret'] = df.get('tvl_change_7d', pd.Series([0.0]*len(df))) / 100.0
        df['apy_norm'] = df.get('apy_cv', pd.Series([0.0]*len(df))) / 100.0
        
        features = df[['price_ret', 'tvl_ret', 'apy_norm']].iloc[-30:].values
        sequence = np.array([features])
        
        try:
            expected_ret, downside_prob = model.predict(sequence, verbose=0)
            volatility = abs(expected_ret[0][0]) + df['price_ret'].std()
            
            return {
                'expected_return': float(expected_ret[0][0]),
                'volatility': float(volatility),
                'downside_prob': float(downside_prob[0][0]),
                'current_price': float(df['price'].iloc[-1])
            }
        except Exception as e:
            print(f"LSTM prediction error: {e}")
            return {
                'expected_return': 0.0,
                'volatility': 0.05,
                'downside_prob': 0.5,
                'current_price': float(df['price'].iloc[-1])
            }
    
    def get_sentiment_score(self, headlines: List[str]) -> Dict:
        """Get sentiment score from news headlines."""
        if not headlines or self.sentiment_model is None:
            return {'net_sentiment': 0.0, 'confidence': 0.5}
        
        import torch
        
        sentiments = []
        for headline in headlines[:10]:  # Limit to 10 headlines
            try:
                encoding = self.sentiment_tokenizer(
                    headline, truncation=True, padding='max_length',
                    max_length=128, return_tensors='pt'
                )
                
                input_ids = encoding['input_ids'].to(self.device)
                attention_mask = encoding['attention_mask'].to(self.device)
                
                with torch.no_grad():
                    outputs = self.sentiment_model(input_ids=input_ids, attention_mask=attention_mask)
                    probs = torch.softmax(outputs.logits, dim=1)
                    # Positive = 0, Negative = 1, Neutral = 2
                    positive = probs[0][0].item()
                    negative = probs[0][1].item()
                    sentiments.append(positive - negative)
            except:
                continue
        
        if not sentiments:
            return {'net_sentiment': 0.0, 'confidence': 0.5}
        
        return {
            'net_sentiment': np.mean(sentiments),
            'confidence': 1 - np.std(sentiments) if len(sentiments) > 1 else 0.5
        }
    
    def calculate_bounds(
        self,
        token: str,
        current_price: Optional[float] = None,
        historical_data: Optional[pd.DataFrame] = None,
        headlines: Optional[List[str]] = None,
        confidence_level: float = 0.80
    ) -> Dict:
        """
        Calculate price prediction bounds for a token.
        
        Args:
            token: Token symbol (e.g., 'sol', 'jup')
            current_price: Optional current price (fetched if not provided)
            historical_data: Optional historical data (fetched if not provided)
            headlines: Optional news headlines for sentiment
            confidence_level: Confidence interval (default 0.80)
        
        Returns:
            Dictionary with bounds, safety score, and component breakdown
        """
        token = token.lower()
        
        # Reset 24h change to prevent cross-token contamination
        self._last_24h_change = 0.0
        
        # ALWAYS fetch from DexScreener to get 24h change data for volatility
        print(f"DEBUG: BoundsCalculator.calculate_bounds for {token}", flush=True)
        fetched_price = self.fetch_current_price(token)
        print(f"DEBUG: fetched_price={fetched_price}, passed_price={current_price}, last_24h_change={self._last_24h_change}", flush=True)
        
        # PRIORITY: Use provided price from frontend if valid, otherwise use fetched price
        # This ensures the displayed current_price matches what frontend shows
        if current_price and current_price > 0:
            # Keep the passed price (from frontend)
            print(f"DEBUG: Using PASSED price: ${current_price}")
        else:
            # Fallback to fetched price only if no valid price was passed
            current_price = fetched_price
            print(f"DEBUG: Using FETCHED price: ${current_price}")
        # Note: _last_24h_change is now populated from fetch_current_price()
        
        # Fetch historical data if not provided
        if historical_data is None:
            historical_data = self.fetch_historical_data(token)
            
        # Append current price to historical data to make volatility dynamic
        # This ensures the safety score reacts immediately to recent price action
        if current_price and current_price > 0 and historical_data is not None and not historical_data.empty:
            new_row = pd.DataFrame({
                'date': [datetime.now()],
                'price': [float(current_price)],
                'tvl_change_7d': [0.0],
                'apy_cv': [0.0]
            })
            historical_data = pd.concat([historical_data, new_row], ignore_index=True)
        
        # Get LSTM prediction
        lstm_result = self.get_lstm_prediction(token, historical_data)
        
        # Get sentiment score
        sentiment_result = self.get_sentiment_score(headlines or [])
        
        
        # Calculate recent historical volatility (PRIMARY source of truth)
        # Special handling for stablecoins - they have very low volatility
        if token in ['usdc', 'usdt']:
            daily_volatility = 0.001  # 0.1% daily volatility for stablecoins
        elif len(historical_data) > 7:
            recent_returns = historical_data['price'].pct_change().dropna().iloc[-14:]
            daily_volatility = recent_returns.std() if len(recent_returns) > 0 else 0.02
        else:
            # Fallback: Estimate volatility from 24h price change if available
            if hasattr(self, '_last_24h_change') and self._last_24h_change != 0:
                # Approximate daily volatility as abs(24h_change) / 2 (conservative estimate)
                daily_volatility = max(0.02, abs(self._last_24h_change / 100.0) * 0.6)
            else:
                # Default fallback when NO data is available
                daily_volatility = 0.05
        
        # Scale to weekly (sqrt(7) rule)
        weekly_volatility = daily_volatility * np.sqrt(7)
        
        # Get token-specific range multiplier (calibrated from backtest)
        range_multiplier = self.RANGE_MULTIPLIERS.get(token, 0.5)
        
        # LSTM contribution (small weight, mostly for direction)
        lstm_volatility = lstm_result['volatility'] * 0.2  # 20% weight to LSTM
        
        # Sentiment impact
        max_sentiment_impact = self.SENTIMENT_IMPACT.get(token, 0.02)
        net_sentiment = sentiment_result['net_sentiment']
        
        # Calculate base uncertainty using HISTORICAL DATA primarily
        # Formula: weekly_vol * range_multiplier + small LSTM adjustment
        base_uncertainty = (weekly_volatility * range_multiplier) + (lstm_volatility * 0.1)
        
        # Get z-score for confidence level
        z_score = self.Z_SCORES.get(confidence_level, 1.28)
        
        # Apply z-score scaling
        scaled_uncertainty = base_uncertainty * z_score
        
        # Add small sentiment adjustment
        sentiment_adjusted_return = lstm_result['expected_return'] * 0.3 + (net_sentiment * max_sentiment_impact)
        
        # Calculate predicted price (small adjustment from current)
        predicted_price = current_price * (1 + sentiment_adjusted_return)
        
        # Calculate bounds (symmetric with slight sentiment asymmetry)
        asymmetry = net_sentiment * 0.02  # Very small asymmetry
        
        lower_bound = current_price * (1 - scaled_uncertainty * (1 + asymmetry))
        upper_bound = current_price * (1 + scaled_uncertainty * (1 - asymmetry))
        
        # Token-specific max range caps
        MAX_RANGES = {
            'sol': 0.10,      # Max 10% for SOL
            'jup': 0.12,      # Max 12% for JUP  
            'usdt': 0.005,    # Max 0.5% for USDT
            'usdc': 0.005,
            'jupsol': 0.10,   # Max 10% for JUPSOL
            'pengu': 0.15     # Max 15% for PENGU
        }
        max_range = MAX_RANGES.get(token, 0.15)
        
        if lower_bound < current_price * (1 - max_range):
            lower_bound = current_price * (1 - max_range)
        if upper_bound > current_price * (1 + max_range):
            upper_bound = current_price * (1 + max_range)
        
        # Calculate safety score
        if current_price > 0:
            range_width_pct = (upper_bound - lower_bound) / current_price * 100
        else:
            range_width_pct = 0.0
        
        # Safety score: narrower range + lower volatility = safer
        volatility_score = max(0, 100 - weekly_volatility * 500)  # Adjusted scale
        range_score = max(0, 100 - range_width_pct * 8)  # Tighter scoring
        confidence_score = sentiment_result['confidence'] * 100
        
        safety_score = (volatility_score * 0.4 + range_score * 0.4 + confidence_score * 0.2)
        
        return {
            'token': token.upper(),
            'current_price': round(current_price, 6),
            'predicted_price': round(predicted_price, 6),
            'lower_bound': round(lower_bound, 6),
            'upper_bound': round(upper_bound, 6),
            'range_width_pct': round(range_width_pct, 2),
            'safety_score': round(safety_score, 1),
            
            # Component breakdown
            'lstm_expected_return': round(lstm_result['expected_return'] * 100, 2),
            'lstm_volatility': round(lstm_result['volatility'] * 100, 2),
            'downside_probability': round(lstm_result['downside_prob'], 4),
            'net_sentiment': round(net_sentiment, 4),
            'sentiment_confidence': round(sentiment_result['confidence'], 4),
            'recent_volatility_pct': round(weekly_volatility * 100, 2),
            
            # Metadata
            'confidence_level': confidence_level,
            'prediction_horizon': '7 days'
        }


def calculate_prediction_bounds(
    token: str,
    current_price: Optional[float] = None,
    historical_data: Optional[pd.DataFrame] = None,
    headlines: Optional[List[str]] = None,
    confidence_level: float = 0.80,
    models_dir: str = "models"
) -> Dict:
    """
    Convenience function to calculate price bounds for a token.
    
    Args:
        token: Token symbol
        current_price: Optional current price
        historical_data: Optional historical data
        headlines: Optional news headlines
        confidence_level: Confidence interval
        models_dir: Directory containing models
    
    Returns:
        Bounds dictionary
    """
    calculator = BoundsCalculator(models_dir=models_dir)
    return calculator.calculate_bounds(
        token=token,
        current_price=current_price,
        historical_data=historical_data,
        headlines=headlines,
        confidence_level=confidence_level
    )


def calculate_multi_token_bounds(
    tokens: List[str],
    confidence_level: float = 0.80,
    models_dir: str = "models"
) -> Dict[str, Dict]:
    """
    Calculate bounds for multiple tokens.
    
    Args:
        tokens: List of token symbols
        confidence_level: Confidence interval
        models_dir: Directory containing models
    
    Returns:
        Dictionary mapping token symbols to their bounds
    """
    calculator = BoundsCalculator(models_dir=models_dir)
    results = {}
    
    for token in tokens:
        try:
            results[token.lower()] = calculator.calculate_bounds(
                token=token,
                confidence_level=confidence_level
            )
        except Exception as e:
            print(f"Error calculating bounds for {token}: {e}")
            results[token.lower()] = None
    
    return results


if __name__ == "__main__":
    print("=" * 60)
    print("  PRICE BOUNDS CALCULATOR TEST")
    print("=" * 60)
    
    # Test with SOL
    print("\nFetching SOL bounds...")
    bounds = calculate_prediction_bounds('sol')
    
    print(f"\n  Token: {bounds['token']}")
    print(f"  Current Price: ${bounds['current_price']:.4f}")
    print(f"  Predicted Price: ${bounds['predicted_price']:.4f}")
    print(f"  Lower Bound: ${bounds['lower_bound']:.4f}")
    print(f"  Upper Bound: ${bounds['upper_bound']:.4f}")
    print(f"  Range Width: {bounds['range_width_pct']:.2f}%")
    print(f"  Safety Score: {bounds['safety_score']:.1f}/100")
