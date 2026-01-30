import { useState, useEffect, useCallback, useRef } from 'react';

export interface WSMessage {
    type: 'POSITIONS_UPDATE' | 'POOL_UPDATE' | 'PRICE_UPDATE' | 'CONNECTION';
    data?: any;
    timestamp?: number;
}

export interface UseWebSocketOptions {
    url: string;
    onMessage?: (message: WSMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
    isConnected: boolean;
    lastMessage: WSMessage | null;
    send: (message: any) => void;
    subscribe: (wallet: string) => void;
    unsubscribe: () => void;
}

const WS_URL = 'wss://yieldsense-backend-a8c2.onrender.com';

export const useWebSocket = (options?: Partial<UseWebSocketOptions>): UseWebSocketReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const url = options?.url ?? WS_URL;
    const reconnectDelay = options?.reconnectDelay ?? 3000;
    const maxReconnectAttempts = options?.maxReconnectAttempts ?? 10;

    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectAttempts.current = 0;
                options?.onConnect?.();
            };

            ws.onmessage = (event) => {
                try {
                    const message: WSMessage = JSON.parse(event.data);
                    setLastMessage(message);
                    options?.onMessage?.(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                options?.onDisconnect?.();

                // Attempt reconnection
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++;
                    console.log(`Reconnecting... attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
                    reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }, [url, reconnectDelay, maxReconnectAttempts, options]);

    // Connect on mount
    useEffect(() => {
        connect();

        // Cleanup on unmount
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const send = useCallback((message: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }, []);

    const subscribe = useCallback((wallet: string) => {
        send({ type: 'SUBSCRIBE', wallet });
    }, [send]);

    const unsubscribe = useCallback(() => {
        send({ type: 'UNSUBSCRIBE' });
    }, [send]);

    return {
        isConnected,
        lastMessage,
        send,
        subscribe,
        unsubscribe
    };
};
