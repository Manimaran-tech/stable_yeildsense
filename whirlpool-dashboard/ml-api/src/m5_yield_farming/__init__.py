"""
YieldSense M5: Yield Farming Safety Module
===========================================
Complete yield farming safety assessment system that converts price bounds
into farming safety recommendations.

Components:
- bounds_calculator: Multi-token price bounds calculation
- il_calculator: Impermanent loss range calculation  
- correlation_analyzer: Token correlation/divergence risk
- volatility_analyzer: Intra-week volatility calculation
- profitability_analyzer: Break-even APY calculation
- safety_engine: Complete yield farming safety score
- pool_fetcher: Real-time APY fetching from DeFiLlama
"""

from .bounds_calculator import BoundsCalculator, calculate_prediction_bounds
from .il_calculator import ILCalculator, calculate_il_range
from .correlation_analyzer import CorrelationAnalyzer, calculate_correlation_risk
from .volatility_analyzer import VolatilityAnalyzer, calculate_intra_week_volatility
from .profitability_analyzer import ProfitabilityAnalyzer, calculate_breakeven_apy
from .safety_engine import YieldFarmingSafetyEngine, calculate_yield_farming_safety
from .pool_fetcher import PoolFetcher, fetch_pool_apy

__all__ = [
    'BoundsCalculator',
    'calculate_prediction_bounds',
    'ILCalculator', 
    'calculate_il_range',
    'CorrelationAnalyzer',
    'calculate_correlation_risk',
    'VolatilityAnalyzer',
    'calculate_intra_week_volatility',
    'ProfitabilityAnalyzer',
    'calculate_breakeven_apy',
    'YieldFarmingSafetyEngine',
    'calculate_yield_farming_safety',
    'PoolFetcher',
    'fetch_pool_apy'
]

