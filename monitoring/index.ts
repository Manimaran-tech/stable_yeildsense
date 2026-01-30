import { config } from "dotenv";
import { PriceMonitor } from "./PriceMonitor";
import Decimal from "decimal.js";

// Load environment variables
config();

// Configure Decimal to match SDK settings
// SDK sets: Decimal.set({ precision: 40, toExpPos: 40, toExpNeg: -20, rounding: 1 });
Decimal.set({ precision: 40, toExpPos: 40, toExpNeg: -20, rounding: 1 });

function main() {
    const rpcUrl = process.env.RPC_URL;
    const poolAddress = process.env.POOL_ADDRESS;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const checkInterval = parseInt(process.env.CHECK_INTERVAL_MS || "60000");
    // Start with 0-0 so we don't spam alerts before Firebase connects.
    // We explicitly IGNORE process.env here to prevent the .env file (122/133) from triggering false alerts.
    const lowerBound = 0;
    const upperBound = 0;

    if (!rpcUrl || !poolAddress || !botToken || !chatId) {
        console.error("Missing required environment variables. Please check .env file.");
        process.exit(1);
    }

    const monitor = new PriceMonitor({
        rpcUrl,
        poolAddress,
        telegramBotToken: botToken,
        telegramChatId: chatId,
        checkIntervalMs: checkInterval,
        priceLowerBound: lowerBound,
        priceUpperBound: upperBound
    });

    monitor.start();
}

main();
