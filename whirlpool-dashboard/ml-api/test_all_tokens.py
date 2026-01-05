"""Test all tokens with DexScreener price fetching."""
import sys
import os

# Get absolute path to the 'src' directory (relative to this script)
script_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(script_dir, "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from m5_yield_farming.bounds_calculator import BoundsCalculator

print("Testing all tokens with DexScreener...")
print("=" * 60)

bc = BoundsCalculator('models')

tokens = ['sol', 'jup', 'jupsol', 'pengu', 'usdc', 'usdt']

for token in tokens:
    try:
        result = bc.calculate_bounds(token)
        print(f"\n{token.upper()}:")
        print(f"  Current Price: ${result['current_price']}")
        print(f"  Safety Score: {result['safety_score']} pts")
        print(f"  Weekly Volatility: {result['recent_volatility_pct']}%")
        print(f"  Range: ${result['lower_bound']:.4f} - ${result['upper_bound']:.4f}")
    except Exception as e:
        print(f"\n{token.upper()}: ERROR - {e}")
