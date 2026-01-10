/**
 * StakingYieldCard Component
 * Displays staking APY for LST tokens with combined yield calculation
 */
import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { TrendingUp, Zap, Info, Coins } from 'lucide-react';
import {
    isLSTToken,
    getTokenStakingAPY,
    calculateCombinedYield,
    formatAPY,
    type LSTAPYData
} from '../services/stakingService';

interface StakingYieldCardProps {
    tokenA: string;
    tokenB: string;
    lpAPY?: number; // Estimated LP APY if available
}

export const StakingYieldCard: FC<StakingYieldCardProps> = ({
    tokenA,
    tokenB,
    lpAPY = 0
}) => {
    const [stakingData, setStakingData] = useState<LSTAPYData | null>(null);
    const [lstToken, setLstToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStakingData = async () => {
            setLoading(true);

            // Check if either token is an LST
            let targetToken: string | null = null;

            if (isLSTToken(tokenA)) {
                targetToken = tokenA;
            } else if (isLSTToken(tokenB)) {
                targetToken = tokenB;
            }

            if (targetToken) {
                const data = await getTokenStakingAPY(targetToken);
                setStakingData(data);
                setLstToken(targetToken);
            } else {
                setStakingData(null);
                setLstToken(null);
            }

            setLoading(false);
        };

        fetchStakingData();
    }, [tokenA, tokenB]);

    // Don't render if no LST in pair
    if (!loading && !stakingData) {
        return null;
    }

    // Loading state
    if (loading) {
        return (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 animate-pulse">
                <div className="h-4 w-32 bg-white/10 rounded mb-2"></div>
                <div className="h-6 w-24 bg-white/10 rounded"></div>
            </div>
        );
    }

    // Calculate combined yield
    const combinedYield = stakingData
        ? calculateCombinedYield(stakingData.total_apy, lpAPY)
        : null;

    return (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <Coins className="w-5 h-5 text-purple-400" />
                <span className="font-semibold text-purple-300">Staking Yield</span>
                <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    {lstToken?.toUpperCase()}
                </span>
            </div>

            {/* APY Display */}
            <div className="grid grid-cols-2 gap-3">
                {/* Staking APY */}
                <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Staking APY</div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-green-400">
                            {formatAPY(stakingData?.total_apy || 0)}
                        </span>
                        <Zap className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Base: {formatAPY(stakingData?.base_apy || 0)} + MEV: {formatAPY(stakingData?.mev_boost || 0)}
                    </div>
                </div>

                {/* Total Yield */}
                {combinedYield && lpAPY > 0 && (
                    <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Total Yield</div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-cyan-400">
                                {formatAPY(combinedYield.total_yield)}
                            </span>
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            Staking + LP fees
                        </div>
                    </div>
                )}
            </div>

            {/* Features */}
            {stakingData?.features && stakingData.features.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {stakingData.features.map((feature, idx) => (
                        <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        >
                            {feature}
                        </span>
                    ))}
                </div>
            )}

            {/* Yield Breakdown Bar */}
            {combinedYield && lpAPY > 0 && (
                <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1">Yield Breakdown</div>
                    <div className="h-2 rounded-full overflow-hidden bg-black/30 flex">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-purple-400 h-full transition-all"
                            style={{
                                width: `${(combinedYield.staking_yield / combinedYield.total_yield) * 100}%`
                            }}
                            title={`Staking: ${formatAPY(combinedYield.staking_yield)}`}
                        />
                        <div
                            className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-full transition-all"
                            style={{
                                width: `${(combinedYield.lp_yield / combinedYield.total_yield) * 100}%`
                            }}
                            title={`LP: ${formatAPY(combinedYield.lp_yield)}`}
                        />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                        <span className="text-purple-400">
                            Staking {formatAPY(combinedYield.staking_yield)}
                        </span>
                        <span className="text-cyan-400">
                            LP {formatAPY(combinedYield.lp_yield)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StakingYieldCard;
