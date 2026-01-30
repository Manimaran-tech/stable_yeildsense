import { usePools } from '../hooks/usePools';
import { usePositions } from '../hooks/usePositions';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CreatePositionPanel } from './CreatePositionPanel';
import { getTokenPrice } from '../services/priceService';

// Helper component to fetch and display USD price
const TokenUsdPrice = ({ token }: { token: string }) => {
    const [price, setPrice] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        getTokenPrice(token).then(p => {
            if (mounted) setPrice(p);
        });
        return () => { mounted = false; };
    }, [token]);

    if (price === null) return <span className="text-muted-foreground animate-pulse">...</span>;

    // Format: < $0.01 show 6 decimals, < $1 show 4, else 2
    const decimals = price < 0.01 ? 6 : price < 1 ? 4 : 2;
    return <span>${price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
};

// Helper to get token icon path
const getTokenIcon = (symbol: string) => {
    switch (symbol.toLowerCase()) {
        case 'sol': return '/tokens/sol.png';
        case 'pengu': return '/tokens/pengu.png';
        case 'jup': return '/tokens/jup.png';
        case 'jupsol': return '/tokens/jupsol.png';
        case 'usdc': return '/tokens/usdc.png';
        default: return null;
    }
};

export const PoolList = () => {
    const { pools, loading } = usePools();
    const { refresh: refreshPositions } = usePositions();
    const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(null);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

    const handleDepositClick = (address: string) => {
        setSelectedPoolAddress(address);
        setIsDepositModalOpen(true);
    };

    const handlePositionCreated = () => {
        // Refresh the positions list when a new position is created
        refreshPositions();
        setIsDepositModalOpen(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="bg-[#0a0e1a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl">
            {/* Table Header Section */}
            <div className="px-6 py-5 border-b border-[#1e293b] bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
                <h2 className="text-xl font-bold text-white tracking-tight">Available Pools</h2>
                <p className="text-sm text-slate-400 mt-1">Select a pool to create a new liquidity position</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    {/* Solid Table Header */}
                    <thead>
                        <tr className="bg-[#111827] border-b-2 border-[#2563eb]/30">
                            <th className="px-6 py-4 text-xs font-bold text-slate-300 uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Pair
                                </div>
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-300 uppercase tracking-widest">
                                Price (USD)
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-300 uppercase tracking-widest">
                                Fee Tier
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-300 uppercase tracking-widest">
                                Liquidity
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-300 uppercase tracking-widest text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>

                    {/* Table Body with Solid Rows */}
                    <tbody>
                        {pools.map((pool, index) => {
                            const iconA = getTokenIcon(pool.tokenA);
                            const iconB = getTokenIcon(pool.tokenB);

                            return (
                                <tr
                                    key={pool.address}
                                    className={`
                                        border-b border-[#1e293b] 
                                        hover:bg-[#1e293b]/50 
                                        transition-all duration-200 
                                        group
                                        ${index % 2 === 0 ? 'bg-[#0a0e1a]' : 'bg-[#0d1321]'}
                                    `}
                                >
                                    {/* Pair Column */}
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="flex -space-x-2">
                                                {/* Token A Avatar */}
                                                <div className="w-10 h-10 rounded-full bg-[#0a0e1a] flex items-center justify-center border-2 border-[#0a0e1a] shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/20 overflow-hidden relative">
                                                    {iconA ? (
                                                        <img
                                                            src={iconA}
                                                            alt={pool.tokenA}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                                                            <span className={pool.tokenA.length > 3 ? "text-[10px]" : "text-xs"}>
                                                                {pool.tokenA}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Token B Avatar */}
                                                <div className="w-10 h-10 rounded-full bg-[#0a0e1a] flex items-center justify-center border-2 border-[#0a0e1a] shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/20 overflow-hidden relative">
                                                    {iconB ? (
                                                        <img
                                                            src={iconB}
                                                            alt={pool.tokenB}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold">
                                                            <span className={pool.tokenB.length > 3 ? "text-[10px]" : "text-xs"}>
                                                                {pool.tokenB}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                                                    {pool.tokenA}/{pool.tokenB}
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono truncate max-w-[120px]">
                                                    {pool.address.slice(0, 8)}...
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Price Column */}
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-white text-base">
                                                <TokenUsdPrice token={
                                                    (pool.tokenA === 'SOL' && !['USDC', 'USDT'].includes(pool.tokenB))
                                                        ? pool.tokenB
                                                        : pool.tokenA
                                                } />
                                            </span>
                                            <span className="text-xs text-emerald-400 font-medium">Live</span>
                                        </div>
                                    </td>

                                    {/* Fee Tier Column */}
                                    <td className="px-6 py-5">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#1e293b] text-cyan-400 font-bold text-sm border border-cyan-500/20">
                                            {(pool.feeTier).toFixed(2)}%
                                        </span>
                                    </td>

                                    {/* Liquidity Column */}
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white text-base">{pool.liquidity}</span>
                                        </div>
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-6 py-5 text-right">
                                        <button
                                            onClick={() => handleDepositClick(pool.address)}
                                            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl transition-all duration-200 text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] border border-blue-400/20"
                                        >
                                            <ArrowRightLeft size={16} className="mr-2" />
                                            New Position
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Table Footer */}
            <div className="px-6 py-4 border-t border-[#1e293b] bg-[#0d1321] flex items-center justify-between">
                <span className="text-sm text-slate-400">
                    Showing <span className="text-white font-semibold">{pools.length}</span> pools
                </span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Real-time data
                </div>
            </div>

            {selectedPoolAddress && (() => {
                const selectedPool = pools.find(p => p.address === selectedPoolAddress);
                return (
                    <CreatePositionPanel
                        key={selectedPoolAddress}
                        isOpen={isDepositModalOpen}
                        onClose={() => setIsDepositModalOpen(false)}
                        onSuccess={handlePositionCreated}
                        poolAddress={selectedPoolAddress}
                        tokenA={selectedPool?.tokenA || 'SOL'}
                        tokenB={selectedPool?.tokenB || 'USDC'}
                        feeTier={selectedPool?.feeTier || 0.30}
                    />
                );
            })()}
        </div>
    );
};
