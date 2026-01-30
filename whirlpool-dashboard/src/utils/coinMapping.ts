export const COIN_GECKO_IDS: Record<string, string> = {
    'SOL': 'solana',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'ORCA': 'orca',
    'JupSOL': 'jupiter-staked-sol',
    'BONK': 'bonk',
    'JTO': 'jito-governance-token',
    'PYTH': 'pyth-network',
    'RAY': 'raydium',
    'mSOL': 'msol',
    'bSOL': 'blazestake-staked-sol',
    'WIF': 'dogwifhat',
    'PENGU': 'pudgy-penguins',
    'TRUMP': 'official-trump',
    'JUP': 'jupiter-exchange-solana'
};

export function getCoinGeckoId(symbol: string): string {
    return COIN_GECKO_IDS[symbol] || 'solana'; // Default to SOL if unknown
}
