"""
Profitability Analyzer
======================
Calculates break-even APY threshold needed to overcome IL + gas fees.
"""
import numpy as np
from typing import Dict, Optional


class ProfitabilityAnalyzer:
    """
    Analyzes profitability of yield farming positions.
    
    Determines the minimum APY required to break even after accounting for:
    - Impermanent Loss
    - Gas fees (entry/exit)
    - Holding period
    """
    
    # Default gas fees for Solana (very low)
    DEFAULT_GAS_FEES = {
        'entry': 0.002,   # 0.2% entry cost
        'exit': 0.002     # 0.2% exit cost
    }
    
    # Default holding period
    DEFAULT_HOLDING_DAYS = 7
    
    def calculate_breakeven_apy(
        self,
        il_range: Dict,
        gas_fees: Optional[Dict] = None,
        holding_days: int = 7
    ) -> Dict:
        """
        Calculate the APY needed to break even on a yield farming position.
        
        Args:
            il_range: IL analysis from ILCalculator
            gas_fees: {'entry': float, 'exit': float} as decimals
            holding_days: Expected holding period in days
        
        Returns:
            Break-even APY analysis
        """
        if gas_fees is None:
            gas_fees = self.DEFAULT_GAS_FEES
        
        # Expected IL costs (as positive percentages)
        expected_il_loss_pct = abs(il_range.get('expected_il', 0))
        worst_case_il_pct = abs(il_range.get('worst_il', il_range.get('max_il', 0)))
        
        # Gas fees (as percentages)
        entry_fee_pct = gas_fees.get('entry', 0.002) * 100
        exit_fee_pct = gas_fees.get('exit', 0.002) * 100
        gas_cost_pct = entry_fee_pct + exit_fee_pct
        
        # Total expected cost for the holding period
        total_expected_cost_pct = expected_il_loss_pct + gas_cost_pct
        total_worst_cost_pct = worst_case_il_pct + gas_cost_pct
        
        # Annualize to get required APY
        # Cost is for holding_days, scale to 365 days
        if holding_days > 0:
            periods_per_year = 365 / holding_days
            breakeven_apy_expected = total_expected_cost_pct * periods_per_year
            breakeven_apy_worst = total_worst_cost_pct * periods_per_year
        else:
            breakeven_apy_expected = 0
            breakeven_apy_worst = 0
        
        # Safety margin (recommended APY should be 1.5x break-even)
        recommended_min_apy = breakeven_apy_expected * 1.5
        
        return {
            # Break-even thresholds
            'expected_breakeven_apy': round(breakeven_apy_expected, 1),
            'worst_case_breakeven_apy': round(breakeven_apy_worst, 1),
            'recommended_min_apy': round(recommended_min_apy, 1),
            
            # Cost breakdown
            'expected_il_cost_pct': round(expected_il_loss_pct, 2),
            'worst_case_il_cost_pct': round(worst_case_il_pct, 2),
            'gas_cost_pct': round(gas_cost_pct, 2),
            
            # Period costs
            'expected_weekly_cost_pct': round(total_expected_cost_pct, 2),
            'worst_weekly_cost_pct': round(total_worst_cost_pct, 2),
            
            # Metadata
            'holding_days': holding_days,
            'periods_per_year': round(365 / holding_days, 1) if holding_days > 0 else 0
        }
    
    def calculate_expected_profit(
        self,
        pool_apy: float,
        il_range: Dict,
        gas_fees: Optional[Dict] = None,
        holding_days: int = 7
    ) -> Dict:
        """
        Calculate expected profit/loss for a yield farming position.
        
        Args:
            pool_apy: Annual Percentage Yield of the pool
            il_range: IL analysis from ILCalculator
            gas_fees: Entry/exit fees
            holding_days: Expected holding period
        
        Returns:
            Profit analysis
        """
        breakeven = self.calculate_breakeven_apy(il_range, gas_fees, holding_days)
        
        # Calculate margin over break-even
        apy_margin = pool_apy - breakeven['expected_breakeven_apy']
        apy_margin_worst = pool_apy - breakeven['worst_case_breakeven_apy']
        
        # Profit ratio (how much above break-even)
        if breakeven['expected_breakeven_apy'] > 0:
            profit_ratio = pool_apy / breakeven['expected_breakeven_apy']
        else:
            profit_ratio = float('inf') if pool_apy > 0 else 1.0
        
        # Expected profit for the holding period
        daily_yield = pool_apy / 365
        period_yield_pct = daily_yield * holding_days
        
        expected_period_profit_pct = period_yield_pct - breakeven['expected_weekly_cost_pct']
        worst_case_period_profit_pct = period_yield_pct - breakeven['worst_weekly_cost_pct']
        
        # Assessment
        if apy_margin > breakeven['expected_breakeven_apy']:
            assessment = 'HIGHLY_PROFITABLE'
            message = f'Pool APY is {profit_ratio:.1f}x break-even rate'
        elif apy_margin > 0:
            assessment = 'PROFITABLE'
            message = f'Expected to earn {apy_margin:.1f}% above break-even'
        elif apy_margin > -breakeven['expected_breakeven_apy'] * 0.5:
            assessment = 'MARGINAL'
            message = 'Pool APY is below break-even but close'
        else:
            assessment = 'UNPROFITABLE'
            message = f'Expected to lose {abs(apy_margin):.1f}% annually'
        
        return {
            'pool_apy': pool_apy,
            'expected_breakeven_apy': breakeven['expected_breakeven_apy'],
            'apy_margin': round(apy_margin, 1),
            'apy_margin_worst_case': round(apy_margin_worst, 1),
            'profit_ratio': round(profit_ratio, 2),
            
            # Period-specific profits
            'period_yield_pct': round(period_yield_pct, 2),
            'expected_period_profit_pct': round(expected_period_profit_pct, 2),
            'worst_case_period_profit_pct': round(worst_case_period_profit_pct, 2),
            
            # Assessment
            'assessment': assessment,
            'message': message,
            
            # Costs breakdown
            'cost_breakdown': {
                'expected_il': round(abs(il_range.get('expected_il', 0)), 2),
                'gas_fees': breakeven['gas_cost_pct'],
                'total_expected': breakeven['expected_weekly_cost_pct']
            }
        }
    
    def calculate_optimal_holding_period(
        self,
        pool_apy: float,
        il_range: Dict,
        gas_fees: Optional[Dict] = None,
        max_days: int = 90
    ) -> Dict:
        """
        Find the optimal holding period for maximizing returns.
        
        Longer holding = more yield but potentially more IL.
        Shorter holding = less IL but gas fees eat into returns.
        
        Returns:
            Optimal holding period analysis
        """
        if gas_fees is None:
            gas_fees = self.DEFAULT_GAS_FEES
        
        best_profit_rate = float('-inf')
        optimal_days = 7
        results = []
        
        for days in [1, 3, 7, 14, 30, 60, 90]:
            if days > max_days:
                break
            
            # Calculate profit for this holding period
            profit = self.calculate_expected_profit(
                pool_apy, il_range, gas_fees, days
            )
            
            # Daily profit rate
            if days > 0:
                daily_profit_rate = profit['expected_period_profit_pct'] / days
            else:
                daily_profit_rate = 0
            
            results.append({
                'holding_days': days,
                'period_profit_pct': profit['expected_period_profit_pct'],
                'daily_profit_rate': round(daily_profit_rate, 4),
                'assessment': profit['assessment']
            })
            
            if daily_profit_rate > best_profit_rate and profit['expected_period_profit_pct'] > 0:
                best_profit_rate = daily_profit_rate
                optimal_days = days
        
        return {
            'optimal_holding_days': optimal_days,
            'best_daily_profit_rate': round(best_profit_rate, 4),
            'analysis_by_period': results
        }


def calculate_breakeven_apy(
    il_range: Dict,
    gas_fees: Optional[Dict] = None,
    holding_days: int = 7
) -> Dict:
    """
    Convenience function to calculate break-even APY.
    
    Args:
        il_range: IL analysis from ILCalculator
        gas_fees: Optional gas fee overrides
        holding_days: Expected holding period
    
    Returns:
        Break-even APY analysis
    """
    analyzer = ProfitabilityAnalyzer()
    return analyzer.calculate_breakeven_apy(il_range, gas_fees, holding_days)


if __name__ == "__main__":
    print("=" * 60)
    print("  PROFITABILITY ANALYZER TEST")
    print("=" * 60)
    
    # Example IL range
    il_range = {
        'expected_il': -2.1,
        'worst_il': -4.5,
        'best_il': -0.5
    }
    
    print("\n[Break-Even APY Calculation]")
    print(f"  Expected IL: {il_range['expected_il']:.2f}%")
    print(f"  Worst Case IL: {il_range['worst_il']:.2f}%")
    
    breakeven = calculate_breakeven_apy(il_range, holding_days=7)
    
    print(f"\n  Expected Break-even APY: {breakeven['expected_breakeven_apy']:.1f}%")
    print(f"  Worst Case Break-even APY: {breakeven['worst_case_breakeven_apy']:.1f}%")
    print(f"  Recommended Min APY: {breakeven['recommended_min_apy']:.1f}%")
    
    # Test profit calculation
    print("\n[Profit Analysis @ 45% APY Pool]")
    analyzer = ProfitabilityAnalyzer()
    profit = analyzer.calculate_expected_profit(45.0, il_range, holding_days=7)
    
    print(f"  Pool APY: {profit['pool_apy']:.1f}%")
    print(f"  APY Margin: {profit['apy_margin']:.1f}%")
    print(f"  Profit Ratio: {profit['profit_ratio']:.1f}x")
    print(f"  Assessment: {profit['assessment']}")
    print(f"  {profit['message']}")
    
    # Optimal holding period
    print("\n[Optimal Holding Period]")
    optimal = analyzer.calculate_optimal_holding_period(45.0, il_range)
    
    print(f"  Optimal Period: {optimal['optimal_holding_days']} days")
    print(f"  Best Daily Rate: {optimal['best_daily_profit_rate']:.4f}%")
