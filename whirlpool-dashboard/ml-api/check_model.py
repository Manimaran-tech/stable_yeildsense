
import sys
import os
sys.path.append('src')
from m5_yield_farming.bounds_calculator import BoundsCalculator

print("Initializing BoundsCalculator...")
bc = BoundsCalculator()
if bc.sentiment_model:
    print("SUCCESS: Sentiment model loaded!")
    print(type(bc.sentiment_model))
else:
    print("FAILURE: Sentiment model is None.")
