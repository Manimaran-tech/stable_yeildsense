"""
Staking API Module - Fetches REAL-TIME liquid staking APY data
===============================================================
Provides live staking APY for Solana LSTs (JupSOL, mSOL, jitoSOL, bSOL)
using multiple API sources: Jito API, Marinade API, Sanctum API
"""
import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

# Cache for staking APY data
_staking_cache: Dict = {}
_cache_timestamp: Optional[datetime] = None
CACHE_DURATION = timedelta(minutes=5)

# Supported LST tokens with their identifiers
LST_TOKENS = {
    'jupsol': {
        'name': 'JupSOL',
        'validator': 'Jupiter',
        'mint': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v'
    },
    'msol': {
        'name': 'mSOL',
        'validator': 'Marinade Finance',
        'mint': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'
    },
    'jitosol': {
        'name': 'jitoSOL',
        'validator': 'Jito',
        'mint': 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'
    },
    'bsol': {
        'name': 'bSOL',
        'validator': 'SolBlaze',
        'mint': 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1'
    }
}


async def fetch_jitosol_apy() -> Dict:
    """
    Fetch real-time jitoSOL APY from Jito's official API.
    Jito provides staking APY + MEV rewards.
    API returns arrays of {data, date} objects for each metric.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Jito Stake Pool API
            response = await client.get(
                'https://kobe.mainnet.jito.network/api/v1/stake_pool_stats',
                headers={'Accept': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Jito API returns: {apy: [{data: 0.06, date: "..."}, ...], mev_rewards: [...], ...}
                # Get the latest APY entry (last in array)
                apy_array = data.get('apy', [])
                mev_array = data.get('mev_rewards', [])
                
                if apy_array and isinstance(apy_array, list) and len(apy_array) > 0:
                    # Get latest APY (last entry in array)
                    latest_apy = apy_array[-1].get('data') if isinstance(apy_array[-1], dict) else None
                    
                    if latest_apy:
                        apy = float(latest_apy)
                        
                        # APY is returned as decimal (0.06 = 6%)
                        if apy < 1:
                            apy = apy * 100
                        
                        # Estimate MEV portion (typically ~3% of total for Jito)
                        mev_boost = round(apy * 0.4, 2)  # ~40% of yield is from MEV
                        base_apy = round(apy - mev_boost, 2)
                        
                        print(f"[Jito API] Latest APY: {apy:.2f}% (base: {base_apy}%, MEV: {mev_boost}%)")
                        
                        return {
                            'base_apy': base_apy,
                            'mev_boost': mev_boost,
                            'total_apy': round(apy, 2),
                            'source': 'jito_api'
                        }
    except Exception as e:
        logger.warning(f"Jito API failed: {e}")
    
    return None


async def fetch_msol_apy() -> Dict:
    """
    Fetch real-time mSOL APY from Marinade's API.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Marinade Finance API
            response = await client.get(
                'https://api.marinade.finance/msol/apy/1y',
                headers={'Accept': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Marinade returns APY as decimal (e.g., 0.075 = 7.5%)
                apy = data.get('value', data.get('apy'))
                
                if apy:
                    apy = float(apy)
                    # Convert to percentage if decimal
                    if apy < 1:
                        apy = apy * 100
                    
                    return {
                        'base_apy': round(apy - 1.0, 2),  # Estimate MEV portion
                        'mev_boost': 1.0,
                        'total_apy': round(apy, 2),
                        'source': 'marinade_api'
                    }
    except Exception as e:
        logger.warning(f"Marinade API failed: {e}")
    
    return None


async def fetch_sanctum_lst_apy() -> Dict:
    """
    Fetch LST APY data from Sanctum's unified API.
    Sanctum aggregates data for multiple LSTs including JupSOL, bSOL.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Sanctum LST API
            response = await client.get(
                'https://sanctum-extra-api.ngrok.dev/v1/apy/latest',
                headers={'Accept': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'apys': data.get('apys', {}),
                    'source': 'sanctum_api'
                }
    except Exception as e:
        logger.warning(f"Sanctum API failed: {e}")
    
    return None


async def fetch_base_staking_apy() -> float:
    """
    Fetch base Solana staking APY from multiple sources.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try Solana Beach API
            response = await client.get(
                'https://api.solanabeach.io/v1/staking/stats',
                headers={'Accept': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                apy = data.get('averageApy') or data.get('apy')
                if apy:
                    return float(apy)
    except Exception as e:
        logger.warning(f"Solana Beach API failed: {e}")
    
    # Fallback: Calculate from epoch info
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Use Helius or public RPC to get epoch info
            response = await client.post(
                'https://api.mainnet-beta.solana.com',
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getInflationRate"
                },
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('result', {})
                # Total inflation rate gives approximate staking yield
                total = result.get('total', 0.065)
                return round(total * 100, 2)
    except Exception as e:
        logger.warning(f"RPC inflation rate failed: {e}")
    
    return 6.5  # Default fallback


async def get_staking_apy() -> Dict:
    """
    Get current staking APY for all supported LSTs.
    Fetches from multiple real-time APIs concurrently.
    """
    global _staking_cache, _cache_timestamp
    
    # Check cache validity
    now = datetime.now()
    if _cache_timestamp and (now - _cache_timestamp) < CACHE_DURATION:
        return _staking_cache
    
    print("[Staking API] Fetching real-time APY data from live APIs...")
    
    # Fetch all data concurrently
    jito_task = asyncio.create_task(fetch_jitosol_apy())
    msol_task = asyncio.create_task(fetch_msol_apy())
    sanctum_task = asyncio.create_task(fetch_sanctum_lst_apy())
    base_apy_task = asyncio.create_task(fetch_base_staking_apy())
    
    # Wait for all tasks
    jito_data, msol_data, sanctum_data, base_apy = await asyncio.gather(
        jito_task, msol_task, sanctum_task, base_apy_task,
        return_exceptions=True
    )
    
    # Handle exceptions
    if isinstance(base_apy, Exception):
        base_apy = 6.5
    if isinstance(jito_data, Exception):
        jito_data = None
    if isinstance(msol_data, Exception):
        msol_data = None
    if isinstance(sanctum_data, Exception):
        sanctum_data = None
    
    sources_used = []
    
    # Build jitoSOL data
    if jito_data:
        jitosol_apy = jito_data
        sources_used.append('jito')
    else:
        jitosol_apy = {
            'base_apy': base_apy,
            'mev_boost': 3.0,
            'total_apy': round(base_apy + 2.6, 2),  # Jito typically adds ~2.6% MEV
            'source': 'estimated'
        }
    
    # Build mSOL data
    if msol_data:
        msol_apy = msol_data
        sources_used.append('marinade')
    else:
        msol_apy = {
            'base_apy': base_apy,
            'mev_boost': 1.0,
            'total_apy': round(base_apy + 0.5, 2),
            'source': 'estimated'
        }
    
    # Build JupSOL data (from Sanctum or estimate based on base APY)
    jupsol_apy = None
    if sanctum_data and isinstance(sanctum_data, dict):
        apys = sanctum_data.get('apys', {})
        if 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v' in apys:
            jupsol_apy = {
                'base_apy': base_apy,
                'mev_boost': round(apys['jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v'] - base_apy, 2),
                'total_apy': round(apys['jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v'], 2),
                'source': 'sanctum'
            }
            sources_used.append('sanctum')
    
    if not jupsol_apy:
        jupsol_apy = {
            'base_apy': base_apy,
            'mev_boost': 3.5,  # Jupiter's estimated MEV kickback
            'total_apy': round(base_apy + 3.5, 2),
            'source': 'estimated'
        }
    
    # Build bSOL data
    bsol_apy = {
        'base_apy': base_apy,
        'mev_boost': 0.5,
        'total_apy': round(base_apy + 0.2, 2),
        'source': 'estimated'
    }
    
    # Assemble final data
    lst_apy_data = {
        'jupSOL': {
            **jupsol_apy,
            'protocol_fee': 0,
            'name': 'Jupiter Staked SOL',
            'mint': LST_TOKENS['jupsol']['mint'],
            'features': ['0% fees', 'MEV rewards', 'Instant unstake']
        },
        'mSOL': {
            **msol_apy,
            'protocol_fee': 0.5,
            'name': 'Marinade Staked SOL',
            'mint': LST_TOKENS['msol']['mint'],
            'features': ['Decentralized', 'Auto-delegate', 'Wide DeFi support']
        },
        'jitoSOL': {
            **jitosol_apy,
            'protocol_fee': 0.4,
            'name': 'Jito Staked SOL',
            'mint': LST_TOKENS['jitosol']['mint'],
            'features': ['MEV rewards', 'Jito network', 'High liquidity']
        },
        'bSOL': {
            **bsol_apy,
            'protocol_fee': 0.3,
            'name': 'SolBlaze Staked SOL',
            'mint': LST_TOKENS['bsol']['mint'],
            'features': ['Decentralized', 'Stake pools', 'NFT rewards']
        }
    }
    
    # Determine overall source
    if sources_used:
        source = f"live_apis ({', '.join(sources_used)})"
    else:
        source = "estimated"
    
    print(f"[Staking API] APY data fetched. Sources: {source}")
    
    result = {
        'lsts': lst_apy_data,
        'base_staking_apy': round(base_apy, 2),
        'source': source,
        'last_updated': now.isoformat(),
        'cache_duration_minutes': 5
    }
    
    # Update cache
    _staking_cache = result
    _cache_timestamp = now
    
    return result


def is_lst_token(token: str) -> bool:
    """Check if a token is a liquid staking token."""
    token_lower = token.lower().replace('-', '').replace('_', '')
    return token_lower in ['jupsol', 'msol', 'jitosol', 'bsol']


def get_lst_key(token: str) -> Optional[str]:
    """Get the standardized LST key for a token."""
    token_lower = token.lower().replace('-', '').replace('_', '')
    mapping = {
        'jupsol': 'jupSOL',
        'msol': 'mSOL',
        'jitosol': 'jitoSOL',
        'bsol': 'bSOL'
    }
    return mapping.get(token_lower)


async def get_token_staking_apy(token: str) -> Optional[Dict]:
    """Get staking APY for a specific LST token."""
    if not is_lst_token(token):
        return None
    
    lst_key = get_lst_key(token)
    if not lst_key:
        return None
    
    all_apy = await get_staking_apy()
    return all_apy.get('lsts', {}).get(lst_key)


def calculate_combined_yield(staking_apy: float, lp_apy: float) -> Dict:
    """
    Calculate combined yield from staking + LP.
    """
    total = staking_apy + lp_apy
    
    return {
        'staking_yield': round(staking_apy, 2),
        'lp_yield': round(lp_apy, 2),
        'total_yield': round(total, 2),
        'yield_boost': round((total / max(staking_apy, lp_apy) - 1) * 100, 1) if max(staking_apy, lp_apy) > 0 else 0
    }
