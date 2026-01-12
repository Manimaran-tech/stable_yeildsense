import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TrendingUp, AlertTriangle, Loader2, Coins, Plus, Minus, Trash2, Bell, BellOff } from 'lucide-react';
import { WithdrawModal } from './WithdrawModal';
import { CollectFeesModal } from './CollectFeesModal';
import { ClosePositionModal } from './ClosePositionModal';
import { DepositModal } from './DepositModal';
import { usePositions } from '../hooks/usePositions';
import type { PositionData } from '../hooks/usePositions';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const PositionList = () => {
    const { connected } = useWallet();
    const { positions, loading, error, refresh } = usePositions();

    // Modal states
    const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isCollectFeesModalOpen, setIsCollectFeesModalOpen] = useState(false);
    const [isClosePositionModalOpen, setIsClosePositionModalOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

    // Monitoring state - track which position is being monitored
    const [monitoredPosition, setMonitoredPosition] = useState<string | null>(null);
    const [syncingPosition, setSyncingPosition] = useState<string | null>(null);

    // Sync position bounds to Firebase for monitoring
    const syncPositionToFirebase = async (position: PositionData) => {
        setSyncingPosition(position.address);
        console.log('🔄 Syncing position to Firebase...', position);

        try {
            // Method 1: Update the main config document that monitoring service listens to
            const configRef = doc(db, 'config', 'monitor_settings');
            const data = {
                priceLowerBound: Number(position.minPrice),
                priceUpperBound: Number(position.maxPrice),
                poolAddress: position.whirlpoolAddress,
                poolPair: position.poolPair,
                positionAddress: position.address,
                currentPrice: Number(position.currentPrice),
                lastUpdated: new Date().toISOString()
            };

            console.log('📝 Writing to Firebase:', data);
            await setDoc(configRef, data);

            console.log(`✅ SUCCESS! Position ${position.poolPair} synced to Firebase`);
            console.log(`   Collection: config`);
            console.log(`   Document: monitor_settings`);
            console.log(`   Bounds: $${position.minPrice} - $${position.maxPrice}`);

            setMonitoredPosition(position.address);

            // Show success alert
            alert(`✅ Monitoring enabled!\n\nPool: ${position.poolPair}\nBounds: $${position.minPrice} - $${position.maxPrice}\n\nYou'll receive Telegram alerts when price exits this range.`);

        } catch (error: any) {
            console.error('❌ Failed to sync position to Firebase:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            alert(`❌ Failed to enable monitoring:\n${error.message}\n\nCheck console for details.`);
        } finally {
            setSyncingPosition(null);
        }
    };

    // Disable monitoring for a position
    const disableMonitoring = async () => {
        try {
            console.log('🔕 Disabling monitoring...');
            const configRef = doc(db, 'config', 'monitor_settings');
            await setDoc(configRef, {
                priceLowerBound: 0,
                priceUpperBound: 0,
                lastUpdated: new Date().toISOString()
            });

            setMonitoredPosition(null);
            console.log('✅ Monitoring disabled');
            alert('Monitoring disabled');
        } catch (error: any) {
            console.error('❌ Failed to disable monitoring:', error);
            alert(`Failed to disable monitoring: ${error.message}`);
        }
    };

    const handleCollectFees = (position: PositionData) => {
        setSelectedPosition(position);
        setIsCollectFeesModalOpen(true);
    };

    const handleWithdraw = (position: PositionData) => {
        setSelectedPosition(position);
        setIsWithdrawModalOpen(true);
    };

    const handleAddLiquidity = (position: PositionData) => {
        setSelectedPosition(position);
        setIsDepositModalOpen(true);
    };

    const handleClosePosition = (position: PositionData) => {
        setSelectedPosition(position);
        setIsClosePositionModalOpen(true);
    };

    const handleModalClose = () => {
        setIsWithdrawModalOpen(false);
        setIsCollectFeesModalOpen(false);
        setIsClosePositionModalOpen(false);
        setIsDepositModalOpen(false);
        setSelectedPosition(null);
    };

    const handleSuccess = () => {
        refresh();
        handleModalClose();
    };

    if (!connected) {
        return (
            <div className="bg-[#0a0e1a] border border-[#1e293b]/50 rounded-xl p-8 text-center">
                <p className="text-muted-foreground">Connect your wallet to view your active positions.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-muted-foreground">Fetching your positions from Solana...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <AlertTriangle className="text-red-500 mx-auto mb-2" size={24} />
                <p className="text-red-400">Error loading positions: {error}</p>
                <button onClick={refresh} className="mt-4 px-4 py-2 bg-secondary rounded-lg text-sm hover:bg-secondary/80">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <TrendingUp className="text-blue-500" />
                    My Positions
                </h3>
                <button
                    onClick={refresh}
                    className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-[#1e293b] flex items-center gap-2"
                >
                    <Coins size={14} className="animate-pulse text-yellow-500" />
                    Refresh Data
                </button>
            </div>

            {positions.length === 0 ? (
                <div className="bg-[#0a0e1a] border border-[#1e293b]/50 rounded-2xl p-12 text-center shadow-xl">
                    <div className="w-16 h-16 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                        <TrendingUp size={32} />
                    </div>
                    <p className="text-slate-300 font-medium text-lg">No active positions found</p>
                    <p className="text-sm text-slate-500 mt-2">Open a position in any pool to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {positions.map((pos) => (
                        <div key={pos.address} className="bg-[#0a0e1a] border border-[#1e293b] rounded-2xl p-6 hover:shadow-2xl hover:border-blue-500/30 transition-all duration-300 group relative overflow-hidden">
                            {/* Gradient Glow Effect on Hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                            {/* Header Section */}
                            <div className="flex justify-between items-start mb-6 relative">
                                <div>
                                    <h4 className="font-bold text-xl text-white tracking-tight">{pos.poolPair}</h4>
                                    <p className="text-xs text-slate-500 font-mono mt-1">{pos.whirlpoolAddress.slice(0, 8)}...</p>
                                </div>
                                {pos.inRange ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                        In Range
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                                        <AlertTriangle size={12} />
                                        Out of Range
                                    </div>
                                )}
                            </div>

                            {/* Out of Range Warning */}
                            {!pos.inRange && (
                                <div className="bg-yellow-500/5 border-l-2 border-yellow-500 p-3 mb-5 rounded-r-lg relative">
                                    <p className="text-xs text-yellow-200 font-medium leading-relaxed">
                                        ⚠️ Fees are paused. Price is outside your range.
                                    </p>
                                </div>
                            )}

                            {/* Stats Grid */}
                            <div className="space-y-4 mb-6 relative">
                                {/* Liquidity */}
                                <div className="flex justify-between items-center p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                                    <span className="text-xs font-medium text-slate-400">Liquidity</span>
                                    <span className="font-mono font-bold text-white text-sm">{pos.liquidity}</span>
                                </div>

                                {/* Unclaimed Fees */}
                                <div className="flex justify-between items-center p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                                    <span className="text-xs font-medium text-slate-400">Unclaimed Fees</span>
                                    {BigInt(pos.unclaimedFeesA || '0') > 0 || BigInt(pos.unclaimedFeesB || '0') > 0 ? (
                                        <span className="font-bold text-emerald-400 text-xs flex items-center gap-1">
                                            <Coins size={12} />
                                            Available
                                        </span>
                                    ) : (
                                        <span className="text-slate-600 text-xs font-mono">—</span>
                                    )}
                                </div>

                                {/* 24H Yield */}
                                <div className="flex justify-between items-center p-3 rounded-xl bg-[#111827] border border-[#1e293b]">
                                    <span className="text-xs font-medium text-slate-400">24H Yield</span>
                                    <span className="font-mono font-bold text-emerald-400 text-sm flex items-center gap-1">
                                        <TrendingUp size={12} />
                                        {pos.yield24h || '0.00%'}
                                    </span>
                                </div>
                            </div>

                            {/* Range Visualization */}
                            <div className="mb-6 relative">
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-2">
                                    <span>${parseFloat(pos.minPrice).toFixed(4)}</span>
                                    <span>${parseFloat(pos.maxPrice).toFixed(4)}</span>
                                </div>
                                <div className="w-full h-3 bg-[#1e293b] rounded-full overflow-hidden relative shadow-inner">
                                    {/* Range Bar */}
                                    <div
                                        className={`h-full rounded-full ${pos.inRange ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-yellow-500/50'}`}
                                        style={{ width: '100%' }}
                                    />
                                    {/* Current Price Marker */}
                                    <div
                                        className="absolute top-0 h-full w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 scale-y-125"
                                        style={{
                                            left: `${Math.min(100, Math.max(0, ((parseFloat(pos.currentPrice) - parseFloat(pos.minPrice)) / (parseFloat(pos.maxPrice) - parseFloat(pos.minPrice))) * 100))}%`
                                        }}
                                    />
                                </div>
                                <div className="text-center text-xs mt-2 font-mono font-medium text-white">
                                    Current: <span className={pos.inRange ? 'text-emerald-400' : 'text-yellow-400'}>${pos.currentPrice}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3 relative">
                                {/* Monitor Button - Full Width */}
                                <button
                                    onClick={() => monitoredPosition === pos.address ? disableMonitoring() : syncPositionToFirebase(pos)}
                                    disabled={syncingPosition === pos.address}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${monitoredPosition === pos.address
                                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                                        : 'bg-[#111827] text-white hover:text-cyan-400 hover:bg-[#1e293b] border-[#1e293b] hover:border-cyan-500/30'
                                        }`}
                                >
                                    {syncingPosition === pos.address ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : monitoredPosition === pos.address ? (
                                        <Bell size={14} className="text-cyan-400" />
                                    ) : (
                                        <BellOff size={14} />
                                    )}
                                    {monitoredPosition === pos.address ? 'Monitoring Active' : 'Enable Telegram Alerts'}
                                </button>

                                <div className="grid grid-cols-2 gap-3 relative">
                                    <button
                                        onClick={() => handleCollectFees(pos)}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-[#111827] text-white hover:text-emerald-400 hover:bg-[#1e293b] rounded-xl text-xs font-bold transition-all border border-[#1e293b] hover:border-emerald-500/30"
                                    >
                                        <Coins size={14} />
                                        Collect
                                    </button>
                                    <button
                                        onClick={() => handleAddLiquidity(pos)}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-[#111827] text-white hover:text-blue-400 hover:bg-[#1e293b] rounded-xl text-xs font-bold transition-all border border-[#1e293b] hover:border-blue-500/30"
                                    >
                                        <Plus size={14} />
                                        Add
                                    </button>
                                    <button
                                        onClick={() => handleWithdraw(pos)}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-[#111827] text-white hover:text-purple-400 hover:bg-[#1e293b] rounded-xl text-xs font-bold transition-all border border-[#1e293b] hover:border-purple-500/30"
                                    >
                                        <Minus size={14} />
                                        Withdraw
                                    </button>
                                    <button
                                        onClick={() => handleClosePosition(pos)}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-[#111827] text-white hover:text-red-400 hover:bg-[#1e293b] rounded-xl text-xs font-bold transition-all border border-[#1e293b] hover:border-red-500/30"
                                    >
                                        <Trash2 size={14} />
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            {selectedPosition && (
                <>
                    <WithdrawModal
                        isOpen={isWithdrawModalOpen}
                        onClose={handleModalClose}
                        positionAddress={selectedPosition.address}
                    />
                    <CollectFeesModal
                        isOpen={isCollectFeesModalOpen}
                        onClose={handleModalClose}
                        positionAddress={selectedPosition.address}
                        positionMint={selectedPosition.positionMint}
                        poolPair={selectedPosition.poolPair}
                        unclaimedFeesA={selectedPosition.unclaimedFeesA}
                        unclaimedFeesB={selectedPosition.unclaimedFeesB}
                        onSuccess={handleSuccess}
                    />
                    <ClosePositionModal
                        isOpen={isClosePositionModalOpen}
                        onClose={handleModalClose}
                        positionAddress={selectedPosition.address}
                        positionMint={selectedPosition.positionMint}
                        poolPair={selectedPosition.poolPair}
                        liquidity={selectedPosition.liquidity}
                        onSuccess={handleSuccess}
                    />
                    <DepositModal
                        isOpen={isDepositModalOpen}
                        onClose={handleModalClose}
                        poolAddress={selectedPosition.whirlpoolAddress}
                        tokenA={selectedPosition.poolPair.split('/')[0]}
                        tokenB={selectedPosition.poolPair.split('/')[1]}
                        onSuccess={handleSuccess}
                    />
                </>
            )}
        </div>
    );
};
