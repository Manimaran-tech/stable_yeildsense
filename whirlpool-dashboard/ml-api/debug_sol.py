import os
import sys
import pandas as pd
import numpy as np

# Get absolute path to the 'src' directory
script_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(script_dir, "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from m5_yield_farming.bounds_calculator import BoundsCalculator

def debug_sol():
    bc = BoundsCalculator('models')
    print("\n" + "="*40)
    print("DEBUGGING SOL PREDICTION")
    print("="*40)
    
    # 1. Check Historical Data
    df = bc.fetch_historical_data('sol')
    print(f"Historical Data Rows: {len(df)}")
    if not df.empty:
        print(f"Last Price in Data: ${df['price'].iloc[-1]}")
        print(f"Historical Volatility: {df['price'].pct_change().std() * 100:.2f}% (daily)")
    
    # 2. Run Prediction
    result = bc.calculate_bounds('sol')
    print("\nOutput Metrics:")
    for k, v in result.items():
        if isinstance(v, float):
            print(f"  {k}: {v}")
        else:
            print(f"  {k}: {v}")
            
    # 3. Specific check for 85
    if result['safety_score'] == 85.0:
        print("\n[!] SAFETY SCORE IS HARDCODED TO 85.0 (Check main.py logic vs bounds_calculator.py)")
    
    if abs(result['lstm_expected_return']) > 50:
        print("\n[!] LSTM EXPECTED RETURN IS EXTREMELY HIGH")

if __name__ == "__main__":
    debug_sol()
