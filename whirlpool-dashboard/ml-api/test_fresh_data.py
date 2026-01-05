"""Test the BoundsCalculator to verify fresh data is being fetched."""
import sys
sys.path.insert(0, 'src')

from m5_yield_farming.bounds_calculator import BoundsCalculator

print("Testing BoundsCalculator with fresh data fetch...")
print("=" * 50)

bc = BoundsCalculator('models')

for token in ['sol', 'usdc']:
    print(f"\n{token.upper()}:")
    result = bc.calculate_bounds(token)
    print(f"  Safety Score: {result['safety_score']}")
    print(f"  Current Price: ${result['current_price']}")
    print(f"  Weekly Volatility: {result['recent_volatility_pct']}%")
    print(f"  LSTM Expected Return: {result['lstm_expected_return']}%")
    print(f"  Lower Bound: ${result['lower_bound']:.4f}")
    print(f"  Upper Bound: ${result['upper_bound']:.4f}")
