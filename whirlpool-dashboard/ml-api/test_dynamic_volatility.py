"""Test if safety score reacts to price changes."""
import sys
sys.path.insert(0, 'src')

from m5_yield_farming.bounds_calculator import BoundsCalculator

bc = BoundsCalculator('models')

print("Testing Safety Score Sensitivity to Price:")
print("=" * 40)

# Test 1: Current Price (approx)
p1 = 134.00
r1 = bc.calculate_bounds('sol', current_price=p1)
print(f"Price: ${p1:<8} -> Safety Score: {r1['safety_score']}")

# Test 2: Price Jump (+10%)
p2 = 147.00
r2 = bc.calculate_bounds('sol', current_price=p2)
print(f"Price: ${p2:<8} -> Safety Score: {r2['safety_score']}")

# Test 3: Price Drop (-10%)
p3 = 120.00
r3 = bc.calculate_bounds('sol', current_price=p3)
print(f"Price: ${p3:<8} -> Safety Score: {r3['safety_score']}")

if r1['safety_score'] != r2['safety_score'] or r1['safety_score'] != r3['safety_score']:
    print("\n[SUCCESS] Safety score is DYNAMIC! It changes with price.")
else:
    print("\n[FAIL] Safety score is STATIC. It ignores price changes.")
