"""
Volatility Analyzer
===================
Calculates intra-week volatility within predicted bounds.
Even if price stays in bounds, high volatility leads to more IL accumulation.
"""
import numpy as np
import pandas as pd
from typing import Dict, Optional


class VolatilityAnalyzer:
    """
    Analyzes volatility to assess risk within price prediction bounds.
    
    Higher volatility within bounds = more IL accumulation from rebalancing.
    """
    
    RISK_THRESHOLDS = {
        'low': 80,      # Volatility score below this = LOW risk
        'medium': 120   # Volatility score below this = MEDIUM risk
    }
    
    def calculate_historical_volatility(
        self,
        price_data: pd.DataFrame,
        window: int = 14
    ) -> Dict:
        """
        Calculate historical volatility metrics.
        
        Args:
            price_data: DataFrame with 'price' or 'close' column
            window: Window for volatility calculation
        
        Returns:
            Volatility metrics
        """
        price_col = 'price' if 'price' in price_data.columns else 'close'
        prices = price_data[price_col]
        
        if len(prices) < 5:
            return {
                'daily_volatility_pct': 3.0,
                'weekly_volatility_pct': 7.5,
                'annualized_volatility_pct': 50.0,
                'message': 'Insufficient data, using default volatility'
            }
        
        # Calculate log returns for better volatility estimation
        log_returns = np.log(prices / prices.shift(1)).dropna()
        
        # Daily volatility (standard deviation of returns)
        daily_vol = log_returns.std()
        
        # Recent volatility (last 7 days)
        recent_vol = log_returns.iloc[-7:].std() if len(log_returns) >= 7 else daily_vol
        
        # Weekly volatility (sqrt(7) scaling)
        weekly_vol = daily_vol * np.sqrt(7)
        
        # Annualized volatility
        annualized_vol = daily_vol * np.sqrt(365)
        
        # Volatility trend (is it increasing?)
        if len(log_returns) >= 14:
            old_vol = log_returns.iloc[-14:-7].std()
            new_vol = log_returns.iloc[-7:].std()
            vol_trend = 'increasing' if new_vol > old_vol * 1.1 else (
                'decreasing' if new_vol < old_vol * 0.9 else 'stable'
            )
        else:
            vol_trend = 'unknown'
        
        return {
            'daily_volatility_pct': round(daily_vol * 100, 2),
            'weekly_volatility_pct': round(weekly_vol * 100, 2),
            'recent_volatility_pct': round(recent_vol * 100, 2),
            'annualized_volatility_pct': round(annualized_vol * 100, 2),
            'volatility_trend': vol_trend
        }
    
    def calculate_intra_week_volatility(
        self,
        bounds: Dict,
        historical_data: pd.DataFrame
    ) -> Dict:
        """
        Calculate expected intra-week volatility within predicted bounds.
        
        Even if price stays in bounds, high volatility = more IL from rebalancing.
        
        Args:
            bounds: Price bounds from BoundsCalculator
            historical_data: Historical price data
        
        Returns:
            Volatility analysis with risk scoring
        """
        # Get historical volatility
        hist_vol = self.calculate_historical_volatility(historical_data)
        
        # Predicted volatility from bounds
        # If LSTM volatility is available, use it
        if 'lstm_volatility' in bounds:
            predicted_weekly_vol = bounds['lstm_volatility'] / 100  # Convert from percentage
        else:
            # Estimate from range width
            range_width = bounds.get('range_width_pct', 10) / 100
            predicted_weekly_vol = range_width / 2  # Approximate
        
        # Compare predicted vs historical
        historical_daily_vol = hist_vol['daily_volatility_pct'] / 100
        
        # Volatility score: how much more volatile than usual?
        if historical_daily_vol > 0:
            volatility_score = (predicted_weekly_vol / (historical_daily_vol * np.sqrt(7))) * 100
        else:
            volatility_score = 100
        
        # Risk level based on volatility score
        if volatility_score < self.RISK_THRESHOLDS['low']:
            risk_level = 'LOW'
            message = 'Expected volatility is below historical average'
        elif volatility_score < self.RISK_THRESHOLDS['medium']:
            risk_level = 'MEDIUM'
            message = 'Expected volatility is near historical average'
        else:
            risk_level = 'HIGH'
            message = 'Expected volatility exceeds historical average'
        
        # Estimate IL impact from intra-period volatility
        # More price swings = more IL even if final price is same
        estimated_rebalancing_il = self._estimate_path_dependent_il(
            predicted_weekly_vol, hist_vol['daily_volatility_pct'] / 100
        )
        
        return {
            'daily_volatility_pct': hist_vol['daily_volatility_pct'],
            'weekly_volatility_pct': round(predicted_weekly_vol * 100, 2),
            'recent_volatility_pct': hist_vol.get('recent_volatility_pct', hist_vol['daily_volatility_pct']),
            'annualized_volatility_pct': hist_vol['annualized_volatility_pct'],
            'volatility_score': round(volatility_score, 1),
            'volatility_trend': hist_vol.get('volatility_trend', 'unknown'),
            'risk_level': risk_level,
            'message': message,
            'estimated_path_il_pct': round(estimated_rebalancing_il * 100, 2)
        }
    
    def _estimate_path_dependent_il(
        self,
        weekly_vol: float,
        daily_vol: float
    ) -> float:
        """
        Estimate additional IL from price path (not just final price).
        
        Concentrated liquidity pools are path-dependent - more swings = more IL.
        """
        # Simplified model: each significant swing adds ~0.1% IL
        # Number of expected significant swings in a week
        if daily_vol > 0:
            expected_swings = (weekly_vol / daily_vol) * 0.5
        else:
            expected_swings = 3.5
        
        # Each swing adds approximately 0.1-0.2% IL
        path_il = expected_swings * 0.001 * max(1, weekly_vol * 10)
        
        return min(path_il, 0.05)  # Cap at 5%
    
    def compare_pair_volatility(
        self,
        token_a_data: pd.DataFrame,
        token_b_data: pd.DataFrame
    ) -> Dict:
        """
        Compare volatility between two tokens in a pair.
        
        Mismatched volatilities can indicate higher IL risk.
        """
        vol_a = self.calculate_historical_volatility(token_a_data)
        vol_b = self.calculate_historical_volatility(token_b_data)
        
        # Volatility ratio
        if vol_b['daily_volatility_pct'] > 0:
            vol_ratio = vol_a['daily_volatility_pct'] / vol_b['daily_volatility_pct']
        else:
            vol_ratio = 1.0
        
        # Mismatch assessment
        if 0.5 <= vol_ratio <= 2.0:
            mismatch = 'LOW'
            message = 'Similar volatility levels - balanced pair'
        elif 0.25 <= vol_ratio <= 4.0:
            mismatch = 'MEDIUM'
            message = 'Moderate volatility mismatch - some imbalance'
        else:
            mismatch = 'HIGH'
            message = 'Significant volatility mismatch - high imbalance risk'
        
        return {
            'token_a_volatility': vol_a,
            'token_b_volatility': vol_b,
            'volatility_ratio': round(vol_ratio, 2),
            'mismatch_level': mismatch,
            'message': message
        }


def calculate_intra_week_volatility(
    bounds: Dict,
    historical_data: pd.DataFrame
) -> Dict:
    """
    Convenience function to calculate intra-week volatility.
    
    Args:
        bounds: Price bounds dictionary
        historical_data: Historical price data
    
    Returns:
        Volatility analysis result
    """
    analyzer = VolatilityAnalyzer()
    return analyzer.calculate_intra_week_volatility(bounds, historical_data)


if __name__ == "__main__":
    print("=" * 60)
    print("  VOLATILITY ANALYZER TEST")
    print("=" * 60)
    
    # Generate sample data
    np.random.seed(42)
    dates = pd.date_range(start='2024-01-01', periods=60, freq='D')
    
    # SOL-like price movement
    returns = np.random.normal(0.005, 0.04, 60)
    prices = 120 * np.cumprod(1 + returns)
    
    data = pd.DataFrame({'date': dates, 'price': prices})
    
    # Sample bounds
    bounds = {
        'current_price': prices[-1],
        'lower_bound': prices[-1] * 0.95,
        'upper_bound': prices[-1] * 1.05,
        'range_width_pct': 10.0,
        'lstm_volatility': 4.5
    }
    
    print("\n[Historical Volatility]")
    analyzer = VolatilityAnalyzer()
    hist_vol = analyzer.calculate_historical_volatility(data)
    
    print(f"  Daily Volatility: {hist_vol['daily_volatility_pct']:.2f}%")
    print(f"  Weekly Volatility: {hist_vol['weekly_volatility_pct']:.2f}%")
    print(f"  Annualized Volatility: {hist_vol['annualized_volatility_pct']:.2f}%")
    print(f"  Trend: {hist_vol['volatility_trend']}")
    
    print("\n[Intra-Week Volatility Assessment]")
    result = calculate_intra_week_volatility(bounds, data)
    
    print(f"  Volatility Score: {result['volatility_score']:.1f}")
    print(f"  Risk Level: {result['risk_level']}")
    print(f"  Estimated Path-Dependent IL: {result['estimated_path_il_pct']:.2f}%")
    print(f"  {result['message']}")
