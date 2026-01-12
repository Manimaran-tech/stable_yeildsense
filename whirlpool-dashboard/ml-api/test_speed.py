import asyncio
import time
from staking_api import fetch_jitosol_apy, fetch_msol_apy, fetch_sanctum_lst_apy, fetch_base_staking_apy

async def benchmark(name, func):
    start = time.time()
    try:
        res = await func()
        elapsed = time.time() - start
        print(f"[{name}] Time: {elapsed:.2f}s | Result: {'OK' if res else 'None'}")
    except Exception as e:
        elapsed = time.time() - start
        print(f"[{name}] Time: {elapsed:.2f}s | Error: {e}")

async def main():
    await asyncio.gather(
        benchmark("Jito", fetch_jitosol_apy),
        benchmark("Marinade", fetch_msol_apy),
        benchmark("Sanctum", fetch_sanctum_lst_apy),
        benchmark("Base", fetch_base_staking_apy)
    )

if __name__ == "__main__":
    asyncio.run(main())
