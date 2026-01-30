import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { Connection, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

// Types for WebSocket messages
export interface WSMessage {
    type: 'POSITIONS_UPDATE' | 'POOL_UPDATE' | 'PRICE_UPDATE' | 'CONNECTION' | 'SUBSCRIBE' | 'UNSUBSCRIBE';
    data?: any;
    wallet?: string;
}

// Extended WebSocket with wallet tracking
interface ExtendedWebSocket extends WebSocket {
    wallet?: string;
    isAlive: boolean;
}

// Store WebSocket server instance
let wss: WebSocketServer | null = null;

// Connected clients mapped by wallet address
const clientsByWallet = new Map<string, Set<ExtendedWebSocket>>();

// All connected clients
const allClients = new Set<ExtendedWebSocket>();

// Solana connection for account subscriptions
let solanaConnection: Connection | null = null;

// Active account subscriptions
const accountSubscriptions = new Map<string, number>();

/**
 * Initialize WebSocket server on the same HTTP server as Express
 */
export function initWebSocket(server: HttpServer): WebSocketServer {
    wss = new WebSocketServer({ server });

    // Initialize Solana connection for real-time updates
    const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
    solanaConnection = new Connection(rpcUrl, "confirmed");

    console.log("📡 WebSocket server initialized");

    wss.on("connection", (ws: ExtendedWebSocket) => {
        ws.isAlive = true;
        allClients.add(ws);

        console.log(`🔌 New WebSocket client connected. Total clients: ${allClients.size}`);

        // Send welcome message
        ws.send(JSON.stringify({
            type: "CONNECTION",
            data: { status: "connected", timestamp: Date.now() }
        }));

        // Handle incoming messages
        ws.on("message", (message: Buffer) => {
            try {
                const msg: WSMessage = JSON.parse(message.toString());
                handleMessage(ws, msg);
            } catch (error) {
                console.error("WebSocket message parse error:", error);
            }
        });

        // Handle pong for heartbeat
        ws.on("pong", () => {
            ws.isAlive = true;
        });

        // Handle disconnect
        ws.on("close", () => {
            allClients.delete(ws);

            // Remove from wallet-specific tracking
            if (ws.wallet) {
                const walletClients = clientsByWallet.get(ws.wallet);
                if (walletClients) {
                    walletClients.delete(ws);
                    if (walletClients.size === 0) {
                        clientsByWallet.delete(ws.wallet);
                        // Unsubscribe from Solana account updates if no clients watching
                        unsubscribeFromWallet(ws.wallet);
                    }
                }
            }

            console.log(`🔌 Client disconnected. Total clients: ${allClients.size}`);
        });

        ws.on("error", (error) => {
            console.error("WebSocket client error:", error);
        });
    });

    // Heartbeat to detect dead connections
    const heartbeatInterval = setInterval(() => {
        wss?.clients.forEach((ws) => {
            const extWs = ws as ExtendedWebSocket;
            if (!extWs.isAlive) {
                return extWs.terminate();
            }
            extWs.isAlive = false;
            extWs.ping();
        });
    }, 30000);

    wss.on("close", () => {
        clearInterval(heartbeatInterval);
    });

    return wss;
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(ws: ExtendedWebSocket, msg: WSMessage) {
    switch (msg.type) {
        case "SUBSCRIBE":
            if (msg.wallet) {
                ws.wallet = msg.wallet;

                // Add to wallet-specific tracking
                if (!clientsByWallet.has(msg.wallet)) {
                    clientsByWallet.set(msg.wallet, new Set());
                }
                clientsByWallet.get(msg.wallet)!.add(ws);

                console.log(`📌 Client subscribed to wallet: ${msg.wallet}`);

                // Subscribe to Solana account updates for this wallet
                subscribeToWallet(msg.wallet);
            }
            break;

        case "UNSUBSCRIBE":
            if (ws.wallet) {
                const walletClients = clientsByWallet.get(ws.wallet);
                if (walletClients) {
                    walletClients.delete(ws);
                    if (walletClients.size === 0) {
                        clientsByWallet.delete(ws.wallet);
                        unsubscribeFromWallet(ws.wallet);
                    }
                }
                ws.wallet = undefined;
            }
            break;

        default:
            console.log("Unknown message type:", msg.type);
    }
}

/**
 * Subscribe to Solana account updates for a wallet
 */
async function subscribeToWallet(wallet: string) {
    if (!solanaConnection || accountSubscriptions.has(wallet)) {
        return;
    }

    try {
        const pubkey = new PublicKey(wallet);

        // Subscribe to account changes
        const subId = solanaConnection.onAccountChange(
            pubkey,
            (accountInfo) => {
                console.log(`🔔 Account change detected for wallet: ${wallet}`);
                // Notify clients watching this wallet to refresh their positions
                broadcastToWallet(wallet, "POSITIONS_UPDATE", {
                    wallet,
                    action: "refresh",
                    timestamp: Date.now()
                });
            },
            "confirmed"
        );

        accountSubscriptions.set(wallet, subId);
        console.log(`📡 Subscribed to Solana account: ${wallet}`);
    } catch (error) {
        console.error(`Failed to subscribe to wallet ${wallet}:`, error);
    }
}

/**
 * Unsubscribe from Solana account updates
 */
async function unsubscribeFromWallet(wallet: string) {
    const subId = accountSubscriptions.get(wallet);
    if (subId !== undefined && solanaConnection) {
        try {
            await solanaConnection.removeAccountChangeListener(subId);
            accountSubscriptions.delete(wallet);
            console.log(`📡 Unsubscribed from Solana account: ${wallet}`);
        } catch (error) {
            console.error(`Failed to unsubscribe from wallet ${wallet}:`, error);
        }
    }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcast(type: WSMessage["type"], data: any) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    allClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    console.log(`📢 Broadcast ${type} to ${allClients.size} clients`);
}

/**
 * Broadcast message to clients watching a specific wallet
 */
export function broadcastToWallet(wallet: string, type: WSMessage["type"], data: any) {
    const clients = clientsByWallet.get(wallet);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    console.log(`📢 Broadcast ${type} to ${clients.size} clients watching wallet ${wallet.slice(0, 8)}...`);
}

/**
 * Broadcast pool update (price, liquidity changes)
 */
export function broadcastPoolUpdate(poolAddress: string, data: any) {
    broadcast("POOL_UPDATE", { pool: poolAddress, ...data });
}

/**
 * Broadcast price update
 */
export function broadcastPriceUpdate(data: { symbol: string; price: number }) {
    broadcast("PRICE_UPDATE", data);
}

/**
 * Get WebSocket server instance
 */
export function getWSS(): WebSocketServer | null {
    return wss;
}

/**
 * Get number of connected clients
 */
export function getConnectedClientsCount(): number {
    return allClients.size;
}
