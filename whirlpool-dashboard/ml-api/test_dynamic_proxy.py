"""Test if safety score reacts to 24h price volatility."""
import sys
sys.path.insert(0, 'src')

from m5_yield_farming.bounds_calculator import BoundsCalculator

bc = BoundsCalculator('models')

print("Testing Safety Score Sensitivity to 24h Volatility:")
print("=" * 50)

# Simulate fetching price (so internal state is set if needed, though we override)
# We just need to ensure calculate_bounds runs

# Test 1: Low Volatility (0.5% move)
bc._last_24h_change = 0.5
r1 = bc.calculate_bounds('sol', current_price=134.0)
print(f"24h Change: {bc._last_24h_change}% -> Safety Score: {r1['safety_score']}")

# Test 2: High Volatility (15% move)
bc._last_24h_change = 15.0
r2 = bc.calculate_bounds('sol', current_price=134.0)
print(f"24h Change: {bc._last_24h_change}% -> Safety Score: {r2['safety_score']}")

if r1['safety_score'] != r2['safety_score']:
    print("\n[SUCCESS] Safety score is DYNAMIC! It reacts to market volatility.")
else:
    print("\n[FAIL] Safety score is STATIC. It ignores volatility.")
