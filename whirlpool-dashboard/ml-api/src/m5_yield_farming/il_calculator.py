"""
Impermanent Loss Calculator
===========================
Calculates best-case and worst-case impermanent loss scenarios
based on price prediction bounds for token pairs.
"""
import numpy as np
from typing import Dict, List, Tuple


class ILCalculator:
    """
    Calculates impermanent loss for liquidity pool token pairs.
    
    IL Formula: IL = 2*sqrt(price_ratio) / (1 + price_ratio) - 1
    
    Where price_ratio = (new_price_A / old_price_A) / (new_price_B / old_price_B)
    """
    
    @staticmethod
    def calculate_il_for_ratio(price_ratio: float) -> float:
        """
        Calculate IL for a given price ratio change.
        
        Args:
            price_ratio: Ratio of new price ratio to old price ratio
        
        Returns:
            IL as a decimal (negative value indicates loss)
        """
        if price_ratio <= 0:
            return -1.0
        
        sqrt_ratio = np.sqrt(price_ratio)
        il = 2 * sqrt_ratio / (1 + price_ratio) - 1
        return il
    
    @staticmethod
    def calculate_il_percentage(price_ratio: float) -> float:
        """Calculate IL as a percentage."""
        return ILCalculator.calculate_il_for_ratio(price_ratio) * 100
    
    def calculate_il_range(
        self,
        token_a_bounds: Dict,
        token_b_bounds: Dict
    ) -> Dict:
        """
        Calculate best-case and worst-case IL scenarios.
        
        Examines all 4 corners of the prediction box:
        - (lower_A, lower_B)
        - (lower_A, upper_B)
        - (upper_A, lower_B)
        - (upper_A, upper_B)
        
        Args:
            token_a_bounds: Bounds dict with current_price, lower_bound, upper_bound
            token_b_bounds: Bounds dict with current_price, lower_bound, upper_bound
        
        Returns:
            Dictionary with min_il, max_il, expected_il, il_uncertainty
        """
        # Current prices
        p_a_current = token_a_bounds['current_price']
        p_b_current = token_b_bounds['current_price']
        current_ratio = p_a_current / p_b_current
        
        # Price scenarios (4 corners of the prediction box)
        scenarios = [
            (token_a_bounds['lower_bound'], token_b_bounds['lower_bound']),
            (token_a_bounds['lower_bound'], token_b_bounds['upper_bound']),
            (token_a_bounds['upper_bound'], token_b_bounds['lower_bound']),
            (token_a_bounds['upper_bound'], token_b_bounds['upper_bound']),
        ]
        
        il_values = []
        scenario_details = []
        
        for p_a_future, p_b_future in scenarios:
            future_ratio = p_a_future / p_b_future
            
            # Price ratio change (how much the ratio moved)
            ratio_change = future_ratio / current_ratio
            
            # Calculate IL
            il_pct = self.calculate_il_percentage(ratio_change)
            il_values.append(il_pct)
            
            scenario_details.append({
                'token_a_price': p_a_future,
                'token_b_price': p_b_future,
                'ratio_change': ratio_change,
                'il_pct': il_pct
            })
        
        # Also calculate IL for predicted center scenario
        if 'predicted_price' in token_a_bounds and 'predicted_price' in token_b_bounds:
            center_ratio = token_a_bounds['predicted_price'] / token_b_bounds['predicted_price']
            center_ratio_change = center_ratio / current_ratio
            center_il = self.calculate_il_percentage(center_ratio_change)
        else:
            center_il = np.mean(il_values)
        
        return {
            'min_il': min(il_values),           # Best case (least IL, closest to 0)
            'max_il': max(il_values),           # This is actually closest to 0 when IL is negative
            'worst_il': min(il_values),         # Most negative = worst loss
            'best_il': max(il_values),          # Closest to 0 = least loss
            'expected_il': center_il,           # IL at predicted center
            'average_il': np.mean(il_values),   # Average across scenarios
            'il_uncertainty': np.std(il_values),
            'scenario_details': scenario_details,
            
            # Risk metrics
            'max_il_risk_pct': abs(min(il_values)),  # Worst case as positive number
            'token_a': {
                'current': p_a_current,
                'range': (token_a_bounds['lower_bound'], token_a_bounds['upper_bound'])
            },
            'token_b': {
                'current': p_b_current,
                'range': (token_b_bounds['lower_bound'], token_b_bounds['upper_bound'])
            }
        }
    
    def calculate_il_for_price_change(
        self,
        initial_price_a: float,
        initial_price_b: float,
        final_price_a: float,
        final_price_b: float
    ) -> Dict:
        """
        Calculate IL for specific price changes.
        
        Args:
            initial_price_a: Starting price of token A
            initial_price_b: Starting price of token B
            final_price_a: Ending price of token A
            final_price_b: Ending price of token B
        
        Returns:
            IL calculation result
        """
        initial_ratio = initial_price_a / initial_price_b
        final_ratio = final_price_a / final_price_b
        ratio_change = final_ratio / initial_ratio
        
        il = self.calculate_il_for_ratio(ratio_change)
        
        return {
            'il_decimal': il,
            'il_percentage': il * 100,
            'ratio_change': ratio_change,
            'price_change_a_pct': (final_price_a / initial_price_a - 1) * 100,
            'price_change_b_pct': (final_price_b / initial_price_b - 1) * 100
        }


def calculate_il_range(token_a_bounds: Dict, token_b_bounds: Dict) -> Dict:
    """
    Convenience function to calculate IL range for a token pair.
    
    Args:
        token_a_bounds: Bounds for token A (from BoundsCalculator)
        token_b_bounds: Bounds for token B (from BoundsCalculator)
    
    Returns:
        IL range dictionary
    """
    calculator = ILCalculator()
    return calculator.calculate_il_range(token_a_bounds, token_b_bounds)


if __name__ == "__main__":
    print("=" * 60)
    print("  IMPERMANENT LOSS CALCULATOR TEST")
    print("=" * 60)
    
    # Example bounds for SOL and JUP
    sol_bounds = {
        'current_price': 122.0,
        'predicted_price': 124.0,
        'lower_bound': 118.0,
        'upper_bound': 128.0
    }
    
    jup_bounds = {
        'current_price': 0.85,
        'predicted_price': 0.88,
        'lower_bound': 0.78,
        'upper_bound': 0.95
    }
    
    print("\n[SOL/JUP Pair]")
    print(f"  SOL: ${sol_bounds['current_price']:.2f} (range: ${sol_bounds['lower_bound']:.2f} - ${sol_bounds['upper_bound']:.2f})")
    print(f"  JUP: ${jup_bounds['current_price']:.4f} (range: ${jup_bounds['lower_bound']:.4f} - ${jup_bounds['upper_bound']:.4f})")
    
    il_range = calculate_il_range(sol_bounds, jup_bounds)
    
    print(f"\n  Expected IL: {il_range['expected_il']:.2f}%")
    print(f"  Worst Case IL: {il_range['worst_il']:.2f}%")
    print(f"  Best Case IL: {il_range['best_il']:.2f}%")
    print(f"  IL Uncertainty: ±{il_range['il_uncertainty']:.2f}%")
    
    print("\n[Scenario Details]")
    for i, scenario in enumerate(il_range['scenario_details'], 1):
        print(f"  Scenario {i}: A=${scenario['token_a_price']:.2f}, B=${scenario['token_b_price']:.4f} → IL={scenario['il_pct']:.2f}%")
