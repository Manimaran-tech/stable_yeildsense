"""
Pool Fetcher
============
Fetches real-time pool APYs from DeFiLlama for Solana yield farming pools.
"""
import requests
from typing import Dict, List, Optional, Tuple
import re


class PoolFetcher:
    """
    Fetches real-time yield farming pool data from DeFiLlama.
    """
    
    DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools"
    
    # Token symbol mappings for matching
    TOKEN_SYMBOLS = {
        'sol': ['SOL', 'WSOL', 'wSOL'],
        'usdt': ['USDT'],
        'usdc': ['USDC'],
        'jup': ['JUP'],
        'jupsol': ['JUPSOL', 'jupSOL', 'JupSOL'],
        'pengu': ['PENGU', 'Pengu']
    }
    
    # Solana chain identifier
    SOLANA_CHAIN = "Solana"
    
    def __init__(self):
        self.pools_cache = None
    
    def fetch_all_pools(self) -> List[Dict]:
        """Fetch all pools from DeFiLlama."""
        try:
            print("  Fetching pools from DeFiLlama...")
            response = requests.get(self.DEFILLAMA_YIELDS_URL, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                pools = data.get('data', [])
                
                # Filter Solana pools only
                solana_pools = [
                    p for p in pools 
                    if p.get('chain', '').lower() == 'solana'
                ]
                
                print(f"  Found {len(solana_pools)} Solana pools")
                self.pools_cache = solana_pools
                return solana_pools
            else:
                print(f"  Error fetching pools: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"  Error: {e}")
            return []
    
    def find_pools_for_pair(
        self,
        token_a: str,
        token_b: str,
        min_tvl: float = 10000
    ) -> List[Dict]:
        """
        Find pools containing both tokens.
        
        Args:
            token_a: First token symbol
            token_b: Second token symbol
            min_tvl: Minimum TVL filter (default $10k)
        
        Returns:
            List of matching pools sorted by APY
        """
        if self.pools_cache is None:
            self.fetch_all_pools()
        
        if not self.pools_cache:
            return []
        
        token_a = token_a.lower()
        token_b = token_b.lower()
        
        # Get possible symbol variations
        symbols_a = self.TOKEN_SYMBOLS.get(token_a, [token_a.upper()])
        symbols_b = self.TOKEN_SYMBOLS.get(token_b, [token_b.upper()])
        
        matching_pools = []
        
        for pool in self.pools_cache:
            symbol = pool.get('symbol', '')
            tvl = pool.get('tvlUsd', 0)
            apy = pool.get('apy', 0)
            
            # Skip low TVL pools
            if tvl < min_tvl:
                continue
            
            # Skip if no APY data
            if apy is None or apy <= 0:
                continue
            
            # Check if pool contains both tokens
            symbol_upper = symbol.upper()
            
            has_a = any(s.upper() in symbol_upper for s in symbols_a)
            has_b = any(s.upper() in symbol_upper for s in symbols_b)
            
            if has_a and has_b:
                matching_pools.append({
                    'pool_id': pool.get('pool', ''),
                    'symbol': symbol,
                    'project': pool.get('project', 'Unknown'),
                    'chain': pool.get('chain', ''),
                    'apy': round(apy, 2),
                    'apy_base': round(pool.get('apyBase', 0) or 0, 2),
                    'apy_reward': round(pool.get('apyReward', 0) or 0, 2),
                    'tvl_usd': round(tvl, 0),
                    'il_risk': pool.get('ilRisk', 'unknown'),
                    'exposure': pool.get('exposure', 'unknown')
                })
        
        # Sort by APY descending
        matching_pools.sort(key=lambda x: x['apy'], reverse=True)
        
        return matching_pools
    
    def get_best_pool(
        self,
        token_a: str,
        token_b: str,
        min_tvl: float = 50000
    ) -> Optional[Dict]:
        """
        Get the best pool (highest APY) for a token pair.
        
        Args:
            token_a: First token
            token_b: Second token
            min_tvl: Minimum TVL (default $50k for safety)
        
        Returns:
            Best pool or None
        """
        pools = self.find_pools_for_pair(token_a, token_b, min_tvl)
        
        if not pools:
            return None
        
        return pools[0]  # Highest APY
    
    def get_pool_apy(
        self,
        token_a: str,
        token_b: str,
        min_tvl: float = 50000
    ) -> Tuple[Optional[float], Optional[Dict]]:
        """
        Get the APY for a token pair.
        
        Returns:
            Tuple of (apy, pool_info) or (None, None)
        """
        pool = self.get_best_pool(token_a, token_b, min_tvl)
        
        if pool:
            return pool['apy'], pool
        
        return None, None
    
    def list_available_pairs(self, token: str, min_tvl: float = 10000) -> List[Dict]:
        """
        List all available pairs for a token.
        
        Args:
            token: Token to find pairs for
        
        Returns:
            List of pools containing this token
        """
        if self.pools_cache is None:
            self.fetch_all_pools()
        
        if not self.pools_cache:
            return []
        
        token = token.lower()
        symbols = self.TOKEN_SYMBOLS.get(token, [token.upper()])
        
        matching = []
        
        for pool in self.pools_cache:
            symbol = pool.get('symbol', '')
            tvl = pool.get('tvlUsd', 0)
            apy = pool.get('apy', 0)
            
            if tvl < min_tvl or not apy or apy <= 0:
                continue
            
            symbol_upper = symbol.upper()
            
            if any(s.upper() in symbol_upper for s in symbols):
                matching.append({
                    'symbol': symbol,
                    'project': pool.get('project', 'Unknown'),
                    'apy': round(apy, 2),
                    'tvl_usd': round(tvl, 0)
                })
        
        matching.sort(key=lambda x: x['apy'], reverse=True)
        return matching[:20]  # Top 20


def fetch_pool_apy(token_a: str, token_b: str) -> Tuple[Optional[float], Optional[Dict]]:
    """
    Convenience function to fetch APY for a token pair.
    """
    fetcher = PoolFetcher()
    return fetcher.get_pool_apy(token_a, token_b)


if __name__ == "__main__":
    print("=" * 60)
    print("  POOL FETCHER TEST")
    print("=" * 60)
    
    fetcher = PoolFetcher()
    
    # Test SOL/USDT
    print("\n[Testing SOL/USDT pools]")
    pools = fetcher.find_pools_for_pair('sol', 'usdt', min_tvl=10000)
    
    if pools:
        print(f"  Found {len(pools)} pools:")
        for p in pools[:5]:
            print(f"    {p['project']:15} {p['symbol']:25} APY: {p['apy']:6.2f}%  TVL: ${p['tvl_usd']:,.0f}")
    else:
        print("  No pools found")
    
    # Test SOL/JUP
    print("\n[Testing SOL/JUP pools]")
    pools = fetcher.find_pools_for_pair('sol', 'jup', min_tvl=10000)
    
    if pools:
        print(f"  Found {len(pools)} pools:")
        for p in pools[:5]:
            print(f"    {p['project']:15} {p['symbol']:25} APY: {p['apy']:6.2f}%  TVL: ${p['tvl_usd']:,.0f}")
    else:
        print("  No pools found")
    
    # Test available pairs for SOL
    print("\n[Available SOL pairs]")
    pairs = fetcher.list_available_pairs('sol', min_tvl=100000)
    for p in pairs[:10]:
        print(f"    {p['project']:15} {p['symbol']:25} APY: {p['apy']:6.2f}%")
