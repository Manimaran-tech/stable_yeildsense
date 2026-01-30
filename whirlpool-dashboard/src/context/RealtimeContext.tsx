import React, { createContext, useContext, useEffect, useCallback, useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWebSocket, type WSMessage } from '../hooks/useWebSocket';

// Types for real-time data
interface PositionUpdate {
    wallet: string;
    action: 'refresh' | 'add' | 'remove' | 'update';
    timestamp: number;
    data?: any;
}

interface PoolUpdate {
    pool: string;
    price?: number;
    liquidity?: string;
    timestamp: number;
}

interface PriceUpdate {
    symbol: string;
    price: number;
    timestamp: number;
}

interface RealtimeState {
    positionUpdates: PositionUpdate[];
    poolUpdates: PoolUpdate[];
    priceUpdates: Map<string, PriceUpdate>;
    lastPositionUpdate: number;
    lastPoolUpdate: number;
}

interface RealtimeContextValue extends RealtimeState {
    isConnected: boolean;
    triggerPositionRefresh: () => void;
    clearPositionUpdates: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const useRealtime = () => {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealtime must be used within a RealtimeProvider');
    }
    return context;
};

interface RealtimeProviderProps {
    children: ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
    const { publicKey } = useWallet();
    const [state, setState] = useState<RealtimeState>({
        positionUpdates: [],
        poolUpdates: [],
        priceUpdates: new Map(),
        lastPositionUpdate: 0,
        lastPoolUpdate: 0
    });

    // Handle incoming WebSocket messages
    const handleMessage = useCallback((message: WSMessage) => {
        switch (message.type) {
            case 'POSITIONS_UPDATE':
                setState(prev => ({
                    ...prev,
                    positionUpdates: [...prev.positionUpdates.slice(-10), message.data],
                    lastPositionUpdate: Date.now()
                }));
                break;

            case 'POOL_UPDATE':
                setState(prev => ({
                    ...prev,
                    poolUpdates: [...prev.poolUpdates.slice(-10), message.data],
                    lastPoolUpdate: Date.now()
                }));
                break;

            case 'PRICE_UPDATE':
                setState(prev => {
                    const newPriceUpdates = new Map(prev.priceUpdates);
                    newPriceUpdates.set(message.data.symbol, {
                        ...message.data,
                        timestamp: Date.now()
                    });
                    return { ...prev, priceUpdates: newPriceUpdates };
                });
                break;

            case 'CONNECTION':
                console.log('WebSocket connection established:', message.data);
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }, []);

    const { isConnected, subscribe, unsubscribe } = useWebSocket({
        onMessage: handleMessage,
        onConnect: () => {
            // Subscribe to wallet updates when connected
            if (publicKey) {
                subscribe(publicKey.toString());
            }
        }
    });

    // Subscribe/unsubscribe when wallet changes
    useEffect(() => {
        if (isConnected && publicKey) {
            subscribe(publicKey.toString());
        }
        return () => {
            if (isConnected) {
                unsubscribe();
            }
        };
    }, [publicKey, isConnected, subscribe, unsubscribe]);

    const triggerPositionRefresh = useCallback(() => {
        setState(prev => ({
            ...prev,
            lastPositionUpdate: Date.now()
        }));
    }, []);

    const clearPositionUpdates = useCallback(() => {
        setState(prev => ({
            ...prev,
            positionUpdates: []
        }));
    }, []);

    const value: RealtimeContextValue = {
        ...state,
        isConnected,
        triggerPositionRefresh,
        clearPositionUpdates
    };

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
};
