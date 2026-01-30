import { PoolList } from './PoolList';
import { PositionList } from './PositionList';
import { PortfolioStats } from './PortfolioStats';
import { useWallet } from '@solana/wallet-adapter-react';
import { PriceChart } from './charts/PriceChart';
import { LiquidityChart } from './charts/LiquidityChart';
import { useChartData } from '../hooks/useChartData';

export const Dashboard = () => {
    const { connected } = useWallet();
    const { liquidityData, loading } = useChartData();

    return (
        <div className="relative">
            {/* Left Column: Market Overview & Pools (scrolls with page) */}
            <div className="lg:mr-[26%] space-y-8">
                {/* Market Overview Section */}
                <section>
                    <h2 className="text-2xl font-bold mb-6">Market Overview</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <PriceChart coinId="solana" title="Solana Price" />
                        <LiquidityChart data={liquidityData} loading={loading} />
                    </div>
                </section>

                {/* Active Pools Section */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Available Pools</h2>
                    </div>
                    <PoolList />
                </section>
            </div>

            {/* Right Column: Your Positions - FIXED position with styled scrollbar */}
            <div className="hidden lg:block fixed top-28 right-6 w-[24%] space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600">
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Your Positions</h2>
                        {connected && (
                            <span className="text-sm text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                                Wallet Connected
                            </span>
                        )}
                    </div>
                    <PositionList />
                </section>

                {/* Portfolio Stats */}
                <PortfolioStats />
            </div>
        </div>
    );
};
