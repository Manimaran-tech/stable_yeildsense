"""
Correlation Analyzer
====================
Measures correlation between tokens to assess divergence risk.
High correlation = lower IL risk (tokens move together).
"""
import numpy as np
import pandas as pd
from typing import Dict, Optional


class CorrelationAnalyzer:
    """
    Analyzes correlation between token pairs to assess divergence risk.
    
    Risk Classification:
    - > 0.7 correlation: LOW_RISK (tokens move together)
    - 0.4 - 0.7: MEDIUM_RISK (some divergence)
    - < 0.4: HIGH_RISK (significant divergence)
    """
    
    RISK_THRESHOLDS = {
        'low': 0.7,
        'medium': 0.4
    }
    
    def calculate_correlation(
        self,
        token_a_data: pd.DataFrame,
        token_b_data: pd.DataFrame,
        window: int = 30
    ) -> Dict:
        """
        Calculate rolling correlation between two tokens.
        
        Args:
            token_a_data: DataFrame with 'price' or 'close' column
            token_b_data: DataFrame with 'price' or 'close' column
            window: Rolling window for returns calculation
        
        Returns:
            Correlation analysis result
        """
        # Extract price columns
        price_col_a = 'price' if 'price' in token_a_data.columns else 'close'
        price_col_b = 'price' if 'price' in token_b_data.columns else 'close'
        
        # Calculate returns
        returns_a = token_a_data[price_col_a].pct_change().dropna()
        returns_b = token_b_data[price_col_b].pct_change().dropna()
        
        # Align lengths
        min_len = min(len(returns_a), len(returns_b), window)
        returns_a = returns_a.iloc[-min_len:]
        returns_b = returns_b.iloc[-min_len:]
        
        if len(returns_a) < 5 or len(returns_b) < 5:
            return {
                'correlation': 0.0,
                'divergence_risk_score': 100.0,
                'interpretation': 'HIGH_RISK',
                'message': 'Insufficient data for correlation analysis'
            }
        
        # Calculate correlation
        correlation = returns_a.corr(returns_b)
        
        # Handle NaN
        if np.isnan(correlation):
            correlation = 0.0
        
        # Calculate divergence score (higher = more divergence = more risk)
        divergence_score = (1 - abs(correlation)) * 100
        
        # Interpret risk
        abs_corr = abs(correlation)
        if abs_corr > self.RISK_THRESHOLDS['low']:
            interpretation = 'LOW_RISK'
            message = 'Tokens are highly correlated - low IL risk from divergence'
        elif abs_corr > self.RISK_THRESHOLDS['medium']:
            interpretation = 'MEDIUM_RISK'
            message = 'Tokens show moderate correlation - some IL risk from divergence'
        else:
            interpretation = 'HIGH_RISK'
            message = 'Tokens are weakly correlated - high IL risk from divergence'
        
        # Additional metrics
        beta = self._calculate_beta(returns_a, returns_b)
        
        return {
            'correlation': round(correlation, 4),
            'divergence_risk_score': round(divergence_score, 2),
            'interpretation': interpretation,
            'message': message,
            'beta': round(beta, 4),
            'correlation_direction': 'positive' if correlation > 0 else 'negative',
            'period_days': min_len
        }
    
    def _calculate_beta(self, returns_a: pd.Series, returns_b: pd.Series) -> float:
        """Calculate beta (sensitivity of A to B)."""
        covariance = returns_a.cov(returns_b)
        variance_b = returns_b.var()
        
        if variance_b == 0:
            return 1.0
        
        return covariance / variance_b
    
    def calculate_rolling_correlation(
        self,
        token_a_data: pd.DataFrame,
        token_b_data: pd.DataFrame,
        window: int = 14
    ) -> pd.Series:
        """
        Calculate rolling correlation over time.
        
        Args:
            token_a_data: Price data for token A
            token_b_data: Price data for token B
            window: Rolling window size
        
        Returns:
            Series of rolling correlations
        """
        price_col_a = 'price' if 'price' in token_a_data.columns else 'close'
        price_col_b = 'price' if 'price' in token_b_data.columns else 'close'
        
        returns_a = token_a_data[price_col_a].pct_change().dropna()
        returns_b = token_b_data[price_col_b].pct_change().dropna()
        
        # Align
        min_len = min(len(returns_a), len(returns_b))
        returns_a = returns_a.iloc[-min_len:]
        returns_b = returns_b.iloc[-min_len:]
        
        # Combine for rolling correlation
        combined = pd.DataFrame({
            'a': returns_a.values,
            'b': returns_b.values
        })
        
        return combined['a'].rolling(window).corr(combined['b'])
    
    def get_correlation_stability(
        self,
        token_a_data: pd.DataFrame,
        token_b_data: pd.DataFrame,
        window: int = 14
    ) -> Dict:
        """
        Assess how stable the correlation has been over time.
        
        Unstable correlation = higher risk (relationship may change).
        
        Returns:
            Stability metrics
        """
        rolling_corr = self.calculate_rolling_correlation(
            token_a_data, token_b_data, window
        ).dropna()
        
        if len(rolling_corr) < 5:
            return {
                'stability_score': 50.0,
                'interpretation': 'UNKNOWN',
                'message': 'Insufficient data for stability analysis'
            }
        
        mean_corr = rolling_corr.mean()
        std_corr = rolling_corr.std()
        
        # Stability score: low std = high stability
        stability_score = max(0, 100 - std_corr * 200)
        
        if stability_score > 70:
            interpretation = 'STABLE'
            message = 'Correlation has been stable over time'
        elif stability_score > 40:
            interpretation = 'MODERATE'
            message = 'Correlation shows some variability'
        else:
            interpretation = 'UNSTABLE'
            message = 'Correlation is highly variable - relationship may change'
        
        return {
            'stability_score': round(stability_score, 1),
            'mean_correlation': round(mean_corr, 4),
            'correlation_std': round(std_corr, 4),
            'interpretation': interpretation,
            'message': message
        }


def calculate_correlation_risk(
    token_a_data: pd.DataFrame,
    token_b_data: pd.DataFrame,
    window: int = 30
) -> Dict:
    """
    Convenience function to calculate correlation risk.
    
    Args:
        token_a_data: Price data for token A
        token_b_data: Price data for token B
        window: Analysis window in days
    
    Returns:
        Correlation risk analysis
    """
    analyzer = CorrelationAnalyzer()
    return analyzer.calculate_correlation(token_a_data, token_b_data, window)


if __name__ == "__main__":
    print("=" * 60)
    print("  CORRELATION ANALYZER TEST")
    print("=" * 60)
    
    # Generate sample data
    np.random.seed(42)
    dates = pd.date_range(start='2024-01-01', periods=60, freq='D')
    
    # SOL-like price movement
    sol_returns = np.random.normal(0.01, 0.05, 60)
    sol_prices = 100 * np.cumprod(1 + sol_returns)
    
    # JUP-like price movement (correlated with SOL + some noise)
    jup_returns = sol_returns * 0.8 + np.random.normal(0, 0.02, 60)
    jup_prices = 0.5 * np.cumprod(1 + jup_returns)
    
    sol_data = pd.DataFrame({'date': dates, 'price': sol_prices})
    jup_data = pd.DataFrame({'date': dates, 'price': jup_prices})
    
    print("\n[SOL/JUP Correlation Analysis]")
    result = calculate_correlation_risk(sol_data, jup_data)
    
    print(f"  Correlation: {result['correlation']:.4f}")
    print(f"  Divergence Risk Score: {result['divergence_risk_score']:.1f}")
    print(f"  Interpretation: {result['interpretation']}")
    print(f"  Beta: {result['beta']:.4f}")
    print(f"  {result['message']}")
    
    # Test stability
    analyzer = CorrelationAnalyzer()
    stability = analyzer.get_correlation_stability(sol_data, jup_data)
    
    print(f"\n[Correlation Stability]")
    print(f"  Stability Score: {stability['stability_score']:.1f}")
    print(f"  Mean Correlation: {stability['mean_correlation']:.4f}")
    print(f"  {stability['message']}")
