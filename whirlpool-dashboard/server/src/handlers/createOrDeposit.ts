import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    increaseLiquidityQuoteByInputToken,
    TickUtil,
    TokenExtensionUtil,
    IGNORE_CACHE,
    PriceMath,
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import BN from "bn.js";

export interface CreateOrDepositRequest {
    wallet: string;
    whirlpool: string;
    tickLower?: number;
    tickUpper?: number;
    priceLower?: string;
    priceUpper?: string;
    amountA: string;
    amountB?: string;
}

export interface CreateOrDepositResponse {
    success: boolean;
    positionMint?: string;
    serializedTransaction?: string; // Base64 encoded unsigned transaction
    error?: string;
    isNewPosition: boolean;
}

/**
 * Build transaction for creating a new position or depositing into existing one.
 * Returns an unsigned transaction for client-side signing.
 */
export async function createOrDeposit(request: CreateOrDepositRequest): Promise<CreateOrDepositResponse> {
    console.log("!!! DEBUG: createOrDeposit handler v3 called !!!");
    console.log("Request:", {
        wallet: request.wallet,
        whirlpool: request.whirlpool,
        amountA: request.amountA,
        priceLower: request.priceLower,
        priceUpper: request.priceUpper
    });

    try {
        const connection = getConnection();
        const walletPubkey = new PublicKey(request.wallet);
        const whirlpoolPubkey = new PublicKey(request.whirlpool);

        // Create context with the actual wallet address for building tx
        const dummyWallet = new Wallet({
            publicKey: walletPubkey,
            secretKey: new Uint8Array(64),
        } as any);

        const ctx = WhirlpoolContext.from(
            connection,
            dummyWallet
        );

        const client = buildWhirlpoolClient(ctx);

        // Fetch the whirlpool
        const whirlpool = await client.getPool(whirlpoolPubkey);
        const whirlpoolData = whirlpool.getData();

        let tickLower: number;
        let tickUpper: number;

        if (request.priceLower && request.priceUpper) {
            const tokenA = whirlpool.getTokenAInfo();
            const tokenB = whirlpool.getTokenBInfo();

            console.log("DEBUG: Token decimals - A:", tokenA.decimals, "B:", tokenB.decimals);
            console.log("DEBUG: Tick spacing:", whirlpoolData.tickSpacing);
            console.log("DEBUG: Price inputs - Lower:", request.priceLower, "Upper:", request.priceUpper);

            const rawTickLower = PriceMath.priceToTickIndex(new Decimal(request.priceLower), tokenA.decimals, tokenB.decimals);
            const rawTickUpper = PriceMath.priceToTickIndex(new Decimal(request.priceUpper), tokenA.decimals, tokenB.decimals);

            console.log("DEBUG: Raw ticks - Lower:", rawTickLower, "Upper:", rawTickUpper);

            tickLower = TickUtil.getInitializableTickIndex(rawTickLower, whirlpoolData.tickSpacing);
            tickUpper = TickUtil.getInitializableTickIndex(rawTickUpper, whirlpoolData.tickSpacing);

            console.log("DEBUG: Initializable ticks - Lower:", tickLower, "Upper:", tickUpper);
        } else if (request.tickLower !== undefined && request.tickUpper !== undefined) {
            tickLower = TickUtil.getInitializableTickIndex(
                request.tickLower,
                whirlpoolData.tickSpacing
            );
            tickUpper = TickUtil.getInitializableTickIndex(
                request.tickUpper,
                whirlpoolData.tickSpacing
            );
        } else {
            throw new Error("Must provide either tick indices or prices");
        }

        // Validate tick range
        if (tickLower >= tickUpper) {
            console.error("DEBUG: Invalid tick range! tickLower >= tickUpper");
            throw new Error(`Invalid price range: lower tick (${tickLower}) must be less than upper tick (${tickUpper}). Check your min/max price inputs.`);
        }

        // Check if position already exists by looking for positions in this range
        // getPositions returns a Record<string, Position | null> or similar map
        const positionsRecord = await client.getPositions([walletPubkey]);
        const positions = Object.values(positionsRecord);

        let existingPosition = null;

        for (const pos of positions) {
            if (!pos) continue;
            const posData = pos.getData();
            if (
                posData.whirlpool.equals(whirlpoolPubkey) &&
                posData.tickLowerIndex === tickLower &&
                posData.tickUpperIndex === tickUpper
            ) {
                existingPosition = pos;
                break;
            }
        }

        let positionMint: string | undefined;
        const isNewPosition = !existingPosition;

        // Build context for token extensions (required for quotes)
        const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            whirlpoolData,
            IGNORE_CACHE
        );

        // Get quote for liquidity
        const tokenA = whirlpool.getTokenAInfo();
        const tokenB = whirlpool.getTokenBInfo();
        const currentTick = whirlpoolData.tickCurrentIndex;

        console.log("DEBUG: Current tick:", currentTick, "Range:", tickLower, "-", tickUpper);

        // Determine which token to use for input based on current price position
        // - If current tick >= tickUpper: price is ABOVE range, position needs only Token B
        // - If current tick < tickLower: price is BELOW range, position needs only Token A
        // - If in range: needs both tokens, use Token A as input and SDK calculates B
        let inputMint: PublicKey;
        let inputAmount: Decimal;

        if (currentTick >= tickUpper) {
            console.log("DEBUG: Current price is ABOVE range - using Token B for input");
            // Price above range: only Token B (quote token) is needed
            // We need to calculate the Token B equivalent of amountA
            const priceB = PriceMath.tickIndexToPrice(currentTick, tokenA.decimals, tokenB.decimals);
            const amountBEquivalent = new Decimal(request.amountA).mul(priceB);
            inputMint = tokenB.mint;
            inputAmount = amountBEquivalent;
            console.log("DEBUG: Converted", request.amountA, "Token A to", inputAmount.toString(), "Token B");
        } else if (currentTick < tickLower) {
            console.log("DEBUG: Current price is BELOW range - using Token A for input");
            inputMint = tokenA.mint;
            inputAmount = new Decimal(request.amountA);
        } else {
            console.log("DEBUG: Current price is IN range - using Token A for input");
            inputMint = tokenA.mint;
            inputAmount = new Decimal(request.amountA);
        }

        const quote = increaseLiquidityQuoteByInputToken(
            inputMint,
            inputAmount,
            tickLower,
            tickUpper,
            Percentage.fromFraction(10, 1000), // 1% slippage
            whirlpool,
            tokenExtensionCtx
        );

        console.log("DEBUG: Quote liquidity:", quote.liquidityAmount.toString());

        let builtTx;

        if (isNewPosition) {
            // OPEN NEW POSITION
            const { positionMint: newMint, tx } = await whirlpool.openPosition(
                tickLower,
                tickUpper,
                quote
            );

            positionMint = newMint.toBase58();
            builtTx = await tx.build();

        } else {
            // INCREASE LIQUIDITY ON EXISTING POSITION
            const txBuilder = await existingPosition!.increaseLiquidity(quote);

            positionMint = existingPosition!.getData().positionMint.toBase58();
            builtTx = await txBuilder.build();
        }

        // Get transaction object and signers (e.g. position mint)
        const { transaction, signers } = builtTx;

        // If it's a legacy Transaction, we can set feepayer/blockhash if needed, 
        // but the SDK methods usually handle it or we use the builder methods.
        // The builder uses ctx.provider.wallet (dummyWallet) as fee payer.
        // We should ensure the blockhash is fresh.
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

        if (transaction instanceof Transaction) {
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = walletPubkey;

            if (signers.length > 0) {
                transaction.partialSign(...signers);
            }
        } else {
            // VersionedTransaction
            // SDK build() usually fetches blockhash.
            // We must sign with any generated keypairs (like position mint)
            if (signers.length > 0) {
                transaction.sign(signers);
            }
        }

        // Serialize transaction (unsigned by wallet, but signed by mint) for frontend to sign
        const serializedTx = transaction.serialize();

        return {
            success: true,
            positionMint,
            serializedTransaction: Buffer.from(serializedTx).toString("base64"),
            isNewPosition,
        };
    } catch (error: any) {
        console.error("Error in createOrDeposit:", error);

        // Friendly error for liquidity invariant
        if (error.message?.includes("liquidity must be greater than zero") ||
            error.message?.includes("Invariant failed")) {
            return {
                success: false,
                error: "Deposit amount too small for this price range. Please increase amount.",
                isNewPosition: false
            };
        }

        return {
            success: false,
            error: error.message || "Unknown error",
            isNewPosition: false,
        };
    }
}
