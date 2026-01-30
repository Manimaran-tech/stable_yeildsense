"""
Yield Farming Safety Engine
===========================
THE COMPLETE YIELD FARMING SAFETY CALCULATION

Combines all components into a final safety score (0-100) and recommendation:
- Price prediction confidence
- Impermanent loss risk
- Token correlation/divergence
- Intra-week volatility
- Profitability check

Uses REAL-TIME prices and historical data for accurate predictions.
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
import os

from .bounds_calculator import BoundsCalculator, calculate_prediction_bounds
from .il_calculator import ILCalculator, calculate_il_range
from .correlation_analyzer import CorrelationAnalyzer, calculate_correlation_risk
from .volatility_analyzer import VolatilityAnalyzer, calculate_intra_week_volatility
from .profitability_analyzer import ProfitabilityAnalyzer, calculate_breakeven_apy


class YieldFarmingSafetyEngine:
    """
    Complete yield farming safety assessment system.
    
    Generates a safety score (0-100) and actionable recommendation
    based on real-time price data and ML predictions.
    """
    
    # Component weights for final score
    WEIGHTS = {
        'price_confidence': 0.25,
        'il_risk': 0.25,
        'correlation': 0.20,
        'volatility': 0.15,
        'profitability': 0.15
    }
    
    # Safety thresholds for recommendations
    THRESHOLDS = {
        'safe': 75,
        'moderate': 60,
        'high_risk': 40
    }
    
    # Supported tokens
    SUPPORTED_TOKENS = ['sol', 'jup', 'jupsol', 'pengu', 'usdt', 'usdc']
    
    def __init__(self, models_dir: str = "models"):
        """Initialize with models directory."""
        self.bounds_calculator = BoundsCalculator(models_dir=models_dir)
        self.il_calculator = ILCalculator()
        self.correlation_analyzer = CorrelationAnalyzer()
        self.volatility_analyzer = VolatilityAnalyzer()
        self.profitability_analyzer = ProfitabilityAnalyzer()
    
    def calculate_safety(
        self,
        token_a: str,
        token_b: str,
        pool_apy: float,
        gas_fees: Optional[Dict] = None,
        confidence_level: float = 0.80,
        headlines_a: Optional[List[str]] = None,
        headlines_b: Optional[List[str]] = None
    ) -> Dict:
        """
        THE COMPLETE YIELD FARMING SAFETY CALCULATION
        
        Args:
            token_a: First token in the pair (e.g., 'sol')
            token_b: Second token in the pair (e.g., 'jup')
            pool_apy: Pool APY in percentage (e.g., 45.0 for 45%)
            gas_fees: Optional gas fee overrides {'entry': float, 'exit': float}
            confidence_level: Confidence interval for bounds (default 0.80)
            headlines_a: Optional news headlines for token A
            headlines_b: Optional news headlines for token B
        
        Returns:
            Complete safety analysis with score, recommendation, and breakdown
        """
        token_a = token_a.lower()
        token_b = token_b.lower()
        
        if gas_fees is None:
            gas_fees = {'entry': 0.002, 'exit': 0.002}
        
        print(f"\n[1/5] Calculating price bounds for {token_a.upper()}...")
        token_a_bounds = self.bounds_calculator.calculate_bounds(
            token=token_a,
            headlines=headlines_a,
            confidence_level=confidence_level
        )
        
        print(f"[2/5] Calculating price bounds for {token_b.upper()}...")
        token_b_bounds = self.bounds_calculator.calculate_bounds(
            token=token_b,
            headlines=headlines_b,
            confidence_level=confidence_level
        )
        
        # Fetch historical data for correlation and volatility
        print("[3/5] Analyzing correlation and volatility...")
        historical_data_a = self.bounds_calculator.fetch_historical_data(token_a, days=30)
        historical_data_b = self.bounds_calculator.fetch_historical_data(token_b, days=30)
        
        # ═══════════════════════════════════════════════════════════
        # Component 1: Price Prediction Confidence
        # ═══════════════════════════════════════════════════════════
        
        avg_safety = (token_a_bounds['safety_score'] + token_b_bounds['safety_score']) / 2
        price_confidence_score = avg_safety
        
        # ═══════════════════════════════════════════════════════════
        # Component 2: Impermanent Loss Risk
        # ═══════════════════════════════════════════════════════════
        
        print("[4/5] Calculating impermanent loss scenarios...")
        il_range = self.il_calculator.calculate_il_range(token_a_bounds, token_b_bounds)
        
        # Lower IL = higher score
        # If expected IL > 5%, it's risky
        expected_il_abs = abs(il_range['expected_il'])
        il_risk_score = max(0, 100 - expected_il_abs * 10)
        
        # ═══════════════════════════════════════════════════════════
        # Component 3: Correlation Risk
        # ═══════════════════════════════════════════════════════════
        
        corr_risk = self.correlation_analyzer.calculate_correlation(
            historical_data_a, historical_data_b
        )
        
        if corr_risk['interpretation'] == 'LOW_RISK':
            correlation_score = 90
        elif corr_risk['interpretation'] == 'MEDIUM_RISK':
            correlation_score = 60
        else:
            correlation_score = 30
        
        # ═══════════════════════════════════════════════════════════
        # Component 4: Volatility Risk
        # ═══════════════════════════════════════════════════════════
        
        vol_a = self.volatility_analyzer.calculate_intra_week_volatility(
            token_a_bounds, historical_data_a
        )
        vol_b = self.volatility_analyzer.calculate_intra_week_volatility(
            token_b_bounds, historical_data_b
        )
        
        avg_vol_score = (vol_a['volatility_score'] + vol_b['volatility_score']) / 2
        
        # Lower volatility = higher score
        volatility_score = max(0, 100 - avg_vol_score)
        
        # ═══════════════════════════════════════════════════════════
        # Component 5: Profitability Check
        # ═══════════════════════════════════════════════════════════
        
        print("[5/5] Analyzing profitability...")
        breakeven = self.profitability_analyzer.calculate_breakeven_apy(il_range, gas_fees)
        profit_analysis = self.profitability_analyzer.calculate_expected_profit(
            pool_apy, il_range, gas_fees
        )
        
        # Compare pool APY to breakeven
        apy_margin = pool_apy - breakeven['expected_breakeven_apy']
        
        # Need at least 2x breakeven to be safe
        if apy_margin > breakeven['expected_breakeven_apy']:
            profitability_score = 100
        elif apy_margin > 0:
            profitability_score = 50 + (apy_margin / max(breakeven['expected_breakeven_apy'], 1)) * 50
        else:
            profitability_score = max(0, 50 + apy_margin)  # Negative margin reduces score
        
        # ═══════════════════════════════════════════════════════════
        # COMBINE ALL COMPONENTS
        # ═══════════════════════════════════════════════════════════
        
        total_safety_score = (
            self.WEIGHTS['price_confidence'] * price_confidence_score +
            self.WEIGHTS['il_risk'] * il_risk_score +
            self.WEIGHTS['correlation'] * correlation_score +
            self.WEIGHTS['volatility'] * volatility_score +
            self.WEIGHTS['profitability'] * profitability_score
        )
        
        # ═══════════════════════════════════════════════════════════
        # GENERATE RECOMMENDATION
        # ═══════════════════════════════════════════════════════════
        
        if total_safety_score >= self.THRESHOLDS['safe'] and profitability_score > 50:
            recommendation = "SAFE_TO_FARM"
            message = f"✅ Safe to farm. Expected profit after IL: {apy_margin:.1f}% APY"
            position_size = 1.0  # 100% of intended capital
            
        elif total_safety_score >= self.THRESHOLDS['moderate'] and profitability_score > 30:
            recommendation = "MODERATE_FARM"
            message = f"⚠️ Moderate risk. Farm with caution. Expected margin: {apy_margin:.1f}% APY"
            position_size = 0.5  # 50% of intended capital
            
        elif total_safety_score >= self.THRESHOLDS['high_risk']:
            recommendation = "HIGH_RISK_FARM"
            message = f"⚠️ High risk. Consider single-sided staking instead."
            position_size = 0.25  # 25% of intended capital
            
        else:
            recommendation = "DO_NOT_FARM"
            message = f"❌ Not safe. Expected costs exceed yields. Stay in stablecoins."
            position_size = 0.0
        
        # ═══════════════════════════════════════════════════════════
        # RETURN COMPLETE ANALYSIS
        # ═══════════════════════════════════════════════════════════
        
        return {
            # Overall
            'total_safety_score': round(total_safety_score, 1),
            'recommendation': recommendation,
            'message': message,
            'suggested_position_size': position_size,
            
            # Component scores
            'component_scores': {
                'price_confidence': round(price_confidence_score, 1),
                'il_risk': round(il_risk_score, 1),
                'correlation': round(correlation_score, 1),
                'volatility': round(volatility_score, 1),
                'profitability': round(profitability_score, 1)
            },
            
            # Detailed metrics
            'expected_il_pct': round(il_range['expected_il'], 2),
            'worst_case_il_pct': round(il_range['worst_il'], 2),
            'correlation': round(corr_risk['correlation'], 4),
            'correlation_risk': corr_risk['interpretation'],
            'pool_apy': pool_apy,
            'breakeven_apy': round(breakeven['expected_breakeven_apy'], 1),
            'expected_net_apy': round(apy_margin, 1),
            
            # Price ranges
            'token_a': {
                'symbol': token_a.upper(),
                'current_price': token_a_bounds['current_price'],
                'predicted_price': token_a_bounds['predicted_price'],
                'lower_bound': token_a_bounds['lower_bound'],
                'upper_bound': token_a_bounds['upper_bound'],
                'range_width_pct': token_a_bounds['range_width_pct']
            },
            'token_b': {
                'symbol': token_b.upper(),
                'current_price': token_b_bounds['current_price'],
                'predicted_price': token_b_bounds['predicted_price'],
                'lower_bound': token_b_bounds['lower_bound'],
                'upper_bound': token_b_bounds['upper_bound'],
                'range_width_pct': token_b_bounds['range_width_pct']
            },
            
            # Volatility details
            'volatility': {
                token_a.upper(): {
                    'weekly_pct': vol_a['weekly_volatility_pct'],
                    'risk_level': vol_a['risk_level']
                },
                token_b.upper(): {
                    'weekly_pct': vol_b['weekly_volatility_pct'],
                    'risk_level': vol_b['risk_level']
                }
            },
            
            # Metadata
            'confidence_level': confidence_level,
            'prediction_horizon': '7 days'
        }
    
    def get_supported_tokens(self) -> List[str]:
        """Get list of supported tokens."""
        return self.SUPPORTED_TOKENS
    
    def print_analysis(self, result: Dict):
        """Pretty print the safety analysis."""
        print("\n" + "=" * 60)
        print(f"  YIELD FARMING SAFETY ANALYSIS")
        print(f"  {result['token_a']['symbol']}/{result['token_b']['symbol']} Pair")
        print("=" * 60)
        
        print(f"\n  Safety Score: {result['total_safety_score']:.1f}/100")
        print(f"  Recommendation: {result['recommendation']}")
        print(f"  {result['message']}")
        
        print(f"\n  Expected IL: {result['expected_il_pct']:.2f}%")
        print(f"  Worst Case IL: {result['worst_case_il_pct']:.2f}%")
        print(f"  Pool APY: {result['pool_apy']:.1f}%")
        print(f"  Breakeven APY: {result['breakeven_apy']:.1f}%")
        print(f"  Expected Net Profit: {result['expected_net_apy']:.1f}% APY")
        print(f"  Suggested Position Size: {result['suggested_position_size']*100:.0f}%")
        
        print("\n  Component Breakdown:")
        for comp, score in result['component_scores'].items():
            status = "✅" if score >= 70 else ("⚠️" if score >= 40 else "❌")
            print(f"    - {comp.replace('_', ' ').title()}: {score:.0f}/100 {status}")
        
        print(f"\n  Price Ranges ({int(result['confidence_level']*100)}% confidence):")
        ta = result['token_a']
        tb = result['token_b']
        print(f"    {ta['symbol']}: ${ta['lower_bound']:.4f} - ${ta['upper_bound']:.4f}")
        print(f"    {tb['symbol']}: ${tb['lower_bound']:.4f} - ${tb['upper_bound']:.4f}")
        
        print("=" * 60)


def calculate_yield_farming_safety(
    token_a: str,
    token_b: str,
    pool_apy: float,
    gas_fees: Optional[Dict] = None,
    confidence_level: float = 0.80,
    models_dir: str = "models"
) -> Dict:
    """
    Convenience function for yield farming safety calculation.
    
    Args:
        token_a: First token symbol
        token_b: Second token symbol
        pool_apy: Pool APY as percentage
        gas_fees: Optional gas fees
        confidence_level: Confidence level for bounds
        models_dir: Models directory
    
    Returns:
        Complete safety analysis
    """
    engine = YieldFarmingSafetyEngine(models_dir=models_dir)
    return engine.calculate_safety(
        token_a=token_a,
        token_b=token_b,
        pool_apy=pool_apy,
        gas_fees=gas_fees,
        confidence_level=confidence_level
    )


def interactive_safety_check():
    """
    Interactive CLI for yield farming safety checks.
    Prompts user for token pair and pool APY.
    """
    engine = YieldFarmingSafetyEngine()
    
    print("\n" + "=" * 60)
    print("  YIELD FARMING SAFETY CHECKER")
    print("  Real-time Analysis with LSTM + Sentiment")
    print("=" * 60)
    
    print(f"\n  Supported tokens: {', '.join([t.upper() for t in engine.SUPPORTED_TOKENS])}")
    
    # Get token A
    while True:
        token_a = input("\n  Enter first token (e.g., SOL): ").strip().lower()
        if token_a in engine.SUPPORTED_TOKENS:
            break
        print(f"  ❌ '{token_a}' not supported. Try: {', '.join(engine.SUPPORTED_TOKENS)}")
    
    # Get token B
    while True:
        token_b = input("  Enter second token (e.g., JUP): ").strip().lower()
        if token_b in engine.SUPPORTED_TOKENS:
            break
        print(f"  ❌ '{token_b}' not supported. Try: {', '.join(engine.SUPPORTED_TOKENS)}")
    
    # Get pool APY
    while True:
        try:
            pool_apy = float(input("  Enter pool APY (e.g., 45.0): ").strip())
            if pool_apy >= 0:
                break
            print("  ❌ APY must be non-negative")
        except ValueError:
            print("  ❌ Please enter a valid number")
    
    print("\n  Analyzing... (fetching real-time data)")
    
    # Run analysis
    result = engine.calculate_safety(
        token_a=token_a,
        token_b=token_b,
        pool_apy=pool_apy
    )
    
    # Print results
    engine.print_analysis(result)
    
    return result


if __name__ == "__main__":
    # Run interactive mode
    result = interactive_safety_check()
