import { Wallet, TrendingUp, Coins, PiggyBank } from 'lucide-react';
import { usePositions } from '../hooks/usePositions';

export const PortfolioStats = () => {
    const { positions } = usePositions();

    // Calculate stats from positions
    const totalPositions = positions.length;
    const inRangePositions = positions.filter(p => p.inRange).length;
    const hasUnclaimedFees = positions.some(
        p => BigInt(p.unclaimedFeesA || '0') > 0 || BigInt(p.unclaimedFeesB || '0') > 0
    );

    const stats = [
        {
            label: 'Total Value Locked',
            value: '$0.00',
            icon: Wallet,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20',
        },
        {
            label: 'Total Earnings',
            value: '$0.00',
            icon: TrendingUp,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/20',
        },
        {
            label: 'Unclaimed Fees',
            value: hasUnclaimedFees ? 'Available' : '$0.00',
            icon: Coins,
            color: hasUnclaimedFees ? 'text-yellow-400' : 'text-slate-400',
            bgColor: hasUnclaimedFees ? 'bg-yellow-500/10' : 'bg-slate-500/10',
            borderColor: hasUnclaimedFees ? 'border-yellow-500/20' : 'border-slate-500/20',
        },
        {
            label: 'Active Positions',
            value: `${inRangePositions}/${totalPositions}`,
            icon: PiggyBank,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            borderColor: 'border-purple-500/20',
        },
    ];

    return (
        <div className="bg-[#0a0e1a] border border-[#1e293b]/50 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="text-blue-500" size={20} />
                Portfolio Overview
            </h3>

            <div className="grid grid-cols-1 gap-3">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className={`flex items-center justify-between p-4 rounded-xl ${stat.bgColor} border ${stat.borderColor} transition-all hover:scale-[1.02]`}
                    >
                        <div className="flex items-center gap-3">
                            <stat.icon className={stat.color} size={18} />
                            <span className="text-sm text-slate-400">{stat.label}</span>
                        </div>
                        <span className={`font-bold text-sm ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Quick tip */}
            <div className="mt-4 p-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
                <p className="text-xs text-slate-400 leading-relaxed">
                    💡 <span className="text-indigo-300">Tip:</span> Open a position in any pool to start earning fees from trades.
                </p>
            </div>
        </div>
    );
};
