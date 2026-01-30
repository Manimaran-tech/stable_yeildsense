import { Connection, PublicKey } from "@solana/web3.js";
import { WhirlpoolContext, buildWhirlpoolClient, PriceMath, IGNORE_CACHE } from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import Decimal from "decimal.js";
import fetch from "node-fetch";

export interface PriceMonitorConfig {
    rpcUrl: string;
    poolAddress: string;
    telegramBotToken: string;
    telegramChatId: string;
    checkIntervalMs: number;
    priceLowerBound: number;
    priceUpperBound: number;
}

import { FirebaseManager } from "./FirebaseManager";

export class PriceMonitor {
    private connection: Connection;
    private ctx: WhirlpoolContext;
    private client: ReturnType<typeof buildWhirlpoolClient>;
    private config: PriceMonitorConfig;
    private isRunning: boolean = false;
    private firebaseManager: FirebaseManager;

    constructor(config: PriceMonitorConfig) {
        this.config = config;
        this.connection = new Connection(config.rpcUrl);
        this.firebaseManager = new FirebaseManager();

        // Create a dummy wallet since we are only reading data
        const dummyWallet = {
            signTransaction: async (tx: any) => tx,
            signAllTransactions: async (txs: any[]) => txs,
            publicKey: new PublicKey("11111111111111111111111111111111"),
        } as Wallet;

        this.ctx = WhirlpoolContext.from(
            this.connection,
            dummyWallet,
            undefined // Use default fetcher
        );
        this.client = buildWhirlpoolClient(this.ctx);
    }

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`Starting PriceMonitor for pool ${this.config.poolAddress}...`);
        console.log(`Debug - Bot Token: ${this.config.telegramBotToken.substring(0, 10)}...`);
        console.log(`Debug - Chat ID: ${this.config.telegramChatId}`);

        // Listen for dynamic config updates from Firebase
        this.firebaseManager.listenToConfig((newConfig) => {
            if (newConfig.poolAddress && newConfig.poolAddress !== this.config.poolAddress) {
                console.log(`🔄 Switching monitoring to new pool: ${newConfig.poolAddress}`);
                this.config.poolAddress = newConfig.poolAddress;
            }

            if (newConfig.priceLowerBound !== undefined) {
                this.config.priceLowerBound = newConfig.priceLowerBound;
                console.log(`Updated Lower Bound: ${this.config.priceLowerBound}`);
            }
            if (newConfig.priceUpperBound !== undefined) {
                this.config.priceUpperBound = newConfig.priceUpperBound;
                console.log(`Updated Upper Bound: ${this.config.priceUpperBound}`);
            }
            console.log(`New Thresholds: < ${this.config.priceLowerBound} or > ${this.config.priceUpperBound}`);
        });

        console.log(`Initial Thresholds: < ${this.config.priceLowerBound} or > ${this.config.priceUpperBound}`);

        this.checkPrice(); // Run immediately
        this.sendTelegramAlert(0, true); // Send startup test
        setInterval(() => this.checkPrice(), this.config.checkIntervalMs);
    }

    private async checkPrice() {
        try {
            const poolAddress = new PublicKey(this.config.poolAddress);
            const pool = await this.client.getPool(poolAddress);

            // Refresh data to ensure we have the latest on-chain state.
            // We use the fetcher directly with IGNORE_CACHE to bypass any SDK caching.
            const poolData = await this.ctx.fetcher.getPool(poolAddress, IGNORE_CACHE);
            if (!poolData) {
                throw new Error(`Unable to fetch pool data for ${poolAddress.toBase58()}`);
            }

            // We still need decimals. The 'pool' object (fetched earlier) has them cached, which is fine for Mint info.
            // pool.getData() is stale, but pool.getTokenAInfo() is constant metadata.
            const tokenAInfo = pool.getTokenAInfo();
            const tokenBInfo = pool.getTokenBInfo();

            let price = PriceMath.sqrtPriceX64ToPrice(
                poolData.sqrtPrice,
                tokenAInfo.decimals,
                tokenBInfo.decimals
            );

            // Heuristic to display "Human" price (e.g. USDC per SOL)
            // If Token A is USDC/USDT (Mint starts with 'EP' or 'Es'), we probably want to invert 
            // because standard is usually Quote Token per Base Token (e.g. $ per SOL)
            // But Whirlpool A/B is purely mint sort order.
            // USDC (EP...) and USDT (Es...) > SOL (So111...) ? No.
            // 'E' < 'S'. So USDC/USDT is usually Token A. 
            // Price is B per A. So SOL per USDC. We want USDC per SOL.
            const mintA = tokenAInfo.mint.toBase58();
            const isQuoteTokenA = mintA.startsWith("EPj") || mintA.startsWith("Es9"); // USDC or USDT

            if (isQuoteTokenA) {
                price = PriceMath.invertPrice(price, tokenAInfo.decimals, tokenBInfo.decimals);
            }

            const priceNum = price.toNumber();

            console.log(`[${new Date().toISOString()}] Current Price: ${priceNum.toFixed(6)} ${isQuoteTokenA ? "(Inverted)" : ""}`);

            // Skip alert if we are still using uninitialized defaults (0-0)
            if (this.config.priceLowerBound === 0 && this.config.priceUpperBound === 0) {
                console.log(`[${new Date().toISOString()}] Current Price: ${priceNum.toFixed(6)}. Waiting for configuration...`);
                return;
            }

            if (priceNum < this.config.priceLowerBound || priceNum > this.config.priceUpperBound) {
                console.log("Price out of bounds! Sending alert...");
                await this.sendTelegramAlert(priceNum);
            }

        } catch (error) {
            console.error("Error checking price:", error);
        }
    }

    private async sendTelegramAlert(price: number, isTest: boolean = false) {
        let message = `⚠️ PRICE ALERT\nPool: ${this.config.poolAddress}\nCurrent: ${price.toFixed(6)}\nRange: ${this.config.priceLowerBound} - ${this.config.priceUpperBound}`;
        if (isTest) {
            message = `🟢 MONITOR STARTED\nMonitoring Pool: ${this.config.poolAddress}\nRange: ${this.config.priceLowerBound} - ${this.config.priceUpperBound}\n(This is a test message)`;
        }

        // Hackathon Demo Mode: If token is a placeholder, strictly log to console.
        if (this.config.telegramBotToken.includes("123456:ABC") || this.config.telegramBotToken.includes("TELEGRAM_BOT_TOKEN")) {
            console.log("---------------------------------------------------");
            console.log(`[MOCK TELEGRAM] Alert Triggered!`);
            console.log(message);
            console.log("---------------------------------------------------");
            return;
        }

        const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: this.config.telegramChatId, text: message })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.error("Failed to send real Telegram alert (404). Configured token is invalid.");
                    console.log("Falling back to console alert for demo:");
                    console.log(message);
                } else {
                    const errorText = await response.text();
                    console.error(`Failed to send Telegram alert: ${response.status} ${response.statusText} - ${errorText}`);
                }
            } else {
                console.log("Telegram alert sent successfully.");
            }

            // Log to Firebase regardless of Telegram success/failure (but only if not mock-demo check)
            if (!isTest) {
                this.firebaseManager.logAlert({
                    poolAddress: this.config.poolAddress,
                    price: price,
                    lowerBound: this.config.priceLowerBound,
                    upperBound: this.config.priceUpperBound,
                    message: message,
                    telegramStatus: response.ok ? 'success' : 'failed'
                });
            }
        } catch (error) {
            console.error("Error sending Telegram alert network request:", error);
        }
    }
}
