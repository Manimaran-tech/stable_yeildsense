"""Test script for real-time staking API"""
import asyncio
from staking_api import get_staking_apy

async def test():
    print("Testing Real-Time Staking API...")
    print("-" * 50)
    
    data = await get_staking_apy()
    
    print(f"Source: {data.get('source')}")
    print(f"Base Staking APY: {data.get('base_staking_apy')}%")
    print(f"Last Updated: {data.get('last_updated')}")
    print("-" * 50)
    
    for token, info in data.get('lsts', {}).items():
        print(f"\n{token}:")
        print(f"  Base APY: {info.get('base_apy')}%")
        print(f"  MEV Boost: {info.get('mev_boost')}%")
        print(f"  Total APY: {info.get('total_apy')}%")
        print(f"  Source: {info.get('source', 'N/A')}")

if __name__ == "__main__":
    asyncio.run(test())
