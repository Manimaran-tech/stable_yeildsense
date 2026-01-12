import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    decreaseLiquidityQuoteByLiquidity,
    TokenExtensionUtil,
    IGNORE_CACHE,
    PriceMath,
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { resolveTokenSymbol, getPoolPair } from "../utils/tokenMetadata.js";

// Dummy wallet for read-only operations (no signing)
const dummyKeypair = {
    publicKey: PublicKey.default,
    secretKey: new Uint8Array(64),
};

/**
 * Serializable position info returned to frontend
 */
export interface PositionInfo {
    positionMint: string;
    positionAddress: string;
    whirlpoolAddress: string;
    tickLowerIndex: number;
    tickUpperIndex: number;
    liquidity: string;
    tokenAAmount: string;
    tokenBAmount: string;
    feeOwedA: string;
    feeOwedB: string;
    currentPrice: string;
    minPrice: string;
    maxPrice: string;
    inRange: boolean;
    poolPair: string;
    tokenA: string;
    tokenB: string;
}

/**
 * Fetch all Whirlpool positions for a wallet address
 * Uses the Legacy SDK (@orca-so/whirlpools-sdk)
 */
export async function getPositionsLegacy(walletAddress: string): Promise<PositionInfo[]> {
    const connection = getConnection();

    // Create a read-only context with dummy wallet
    const dummyWallet = new Wallet({
        publicKey: new PublicKey(walletAddress),
        secretKey: new Uint8Array(64),
    } as any);

    const ctx = WhirlpoolContext.from(
        connection,
        dummyWallet
    );

    const client = buildWhirlpoolClient(ctx);

    try {
        const walletPubkey = new PublicKey(walletAddress);
        console.log(`[getPositions] Fetching token accounts for ${walletAddress}`);

        // 1. Fetch all Token Accounts to find Position NFTs
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });

        const positionPDAs: PublicKey[] = [];

        for (const { account } of tokenAccounts.value) {
            const info = account.data.parsed.info;
            const amount = info.tokenAmount.amount;
            const decimals = info.tokenAmount.decimals;
            const mint = new PublicKey(info.mint);

            // Filter for NFTs (Supply=1, Decimals=0)
            if (amount === "1" && decimals === 0) {
                // Derive Position PDA
                const pda = PublicKey.findProgramAddressSync(
                    [Buffer.from("position"), mint.toBuffer()],
                    ORCA_WHIRLPOOL_PROGRAM_ID
                )[0];
                positionPDAs.push(pda);
            }
        }

        console.log(`[getPositions] Found ${positionPDAs.length} potential position PDAs`);

        // 2. Fetch Position Data for all PDAs
        // We use fetcher directly or loop client.getPosition
        // Using loop with parallel execution for now
        const positions = await Promise.all(
            positionPDAs.map(async (pda) => {
                try {
                    return await client.getPosition(pda);
                } catch (e) {
                    return null;
                }
            })
        );

        const validPositions = positions.filter((p): p is NonNullable<typeof p> => p !== null);
        console.log(`[getPositions] Successfully loaded ${validPositions.length} positions`);

        const positionInfos: PositionInfo[] = [];

        for (const position of validPositions) {
            try {
                const positionData = position.getData();

                // Fetch pool to calculate prices/range
                const whirlpool = await client.getPool(positionData.whirlpool);
                const whirlpoolData = whirlpool.getData();
                const tokenAInfo = whirlpool.getTokenAInfo();
                const tokenBInfo = whirlpool.getTokenBInfo();

                const currentPrice = PriceMath.sqrtPriceX64ToPrice(
                    whirlpoolData.sqrtPrice,
                    tokenAInfo.decimals,
                    tokenBInfo.decimals
                );
                const minPrice = PriceMath.tickIndexToPrice(
                    positionData.tickLowerIndex,
                    tokenAInfo.decimals,
                    tokenBInfo.decimals
                );
                const maxPrice = PriceMath.tickIndexToPrice(
                    positionData.tickUpperIndex,
                    tokenAInfo.decimals,
                    tokenBInfo.decimals
                );

                const inRange = whirlpoolData.tickCurrentIndex >= positionData.tickLowerIndex &&
                    whirlpoolData.tickCurrentIndex < positionData.tickUpperIndex;

                // Calculate unclaimed fees (simplified)
                const feeOwedA = Decimal.div(positionData.feeOwedA.toString(), Math.pow(10, tokenAInfo.decimals)).toString();
                const feeOwedB = Decimal.div(positionData.feeOwedB.toString(), Math.pow(10, tokenBInfo.decimals)).toString();

                const { poolPair, tokenA, tokenB } = getPoolPair(
                    tokenAInfo.mint.toBase58(),
                    tokenBInfo.mint.toBase58()
                );

                // Calculate token amounts from liquidity
                // We simulate withdrawing all liquidity to get estimated amounts
                const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
                    ctx.fetcher,
                    whirlpoolData,
                    IGNORE_CACHE
                );

                const quote = decreaseLiquidityQuoteByLiquidity(
                    positionData.liquidity,
                    Percentage.fromFraction(0, 100),
                    position,
                    whirlpool,
                    tokenExtensionCtx
                );

                positionInfos.push({
                    positionMint: positionData.positionMint.toBase58(),
                    positionAddress: position.getAddress().toBase58(),
                    whirlpoolAddress: positionData.whirlpool.toBase58(),
                    tickLowerIndex: positionData.tickLowerIndex,
                    tickUpperIndex: positionData.tickUpperIndex,
                    liquidity: positionData.liquidity.toString(),
                    tokenAAmount: quote.tokenEstA.toString(),
                    tokenBAmount: quote.tokenEstB.toString(),
                    feeOwedA: positionData.feeOwedA.toString(), // Keep raw for now as per interface
                    feeOwedB: positionData.feeOwedB.toString(),
                    currentPrice: currentPrice.toFixed(4),
                    minPrice: minPrice.toFixed(4),
                    maxPrice: maxPrice.toFixed(4),
                    inRange,
                    poolPair,
                    tokenA,
                    tokenB,
                    unclaimedFeesA: feeOwedA,
                    unclaimedFeesB: feeOwedB
                } as any); // Type assertion to handle extra fields if interface mismatch
            } catch (err) {
                console.error(`[getPositions] Error processing position ${position?.getAddress().toBase58()}:`, err);
            }
        }

        return positionInfos;
    } catch (error) {
        console.error("Error fetching positions:", error);
        throw error;
    }
}

/**
 * Get detailed position info including token amounts
 */
export async function getPositionDetails(positionMintAddress: string): Promise<PositionInfo | null> {
    const connection = getConnection();

    const dummyWallet = new Wallet({
        publicKey: PublicKey.default,
        secretKey: new Uint8Array(64),
    } as any);

    const ctx = WhirlpoolContext.from(
        connection,
        dummyWallet
    );

    const client = buildWhirlpoolClient(ctx);

    try {
        const positionMint = new PublicKey(positionMintAddress);
        const position = await client.getPosition(positionMint);

        if (!position) return null;

        const positionData = position.getData();
        const whirlpool = await client.getPool(positionData.whirlpool);
        const whirlpoolData = whirlpool.getData();

        const tokenAInfo = whirlpool.getTokenAInfo();
        const tokenBInfo = whirlpool.getTokenBInfo();

        const currentPrice = PriceMath.sqrtPriceX64ToPrice(
            whirlpoolData.sqrtPrice,
            tokenAInfo.decimals,
            tokenBInfo.decimals
        );
        const minPrice = PriceMath.tickIndexToPrice(
            positionData.tickLowerIndex,
            tokenAInfo.decimals,
            tokenBInfo.decimals
        );
        const maxPrice = PriceMath.tickIndexToPrice(
            positionData.tickUpperIndex,
            tokenAInfo.decimals,
            tokenBInfo.decimals
        );

        const inRange = whirlpoolData.tickCurrentIndex >= positionData.tickLowerIndex &&
            whirlpoolData.tickCurrentIndex < positionData.tickUpperIndex;

        // Calculate token amounts from liquidity using a quote
        // We simulate withdrawing all liquidity with 0 slippage to get estimated amounts
        const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            whirlpoolData,
            IGNORE_CACHE
        );

        const quote = decreaseLiquidityQuoteByLiquidity(
            positionData.liquidity,
            Percentage.fromFraction(0, 100),
            position,
            whirlpool,
            tokenExtensionCtx
        );

        const { poolPair, tokenA, tokenB } = getPoolPair(
            tokenAInfo.mint.toBase58(),
            tokenBInfo.mint.toBase58()
        );

        return {
            positionMint: positionData.positionMint.toBase58(),
            positionAddress: position.getAddress().toBase58(),
            whirlpoolAddress: positionData.whirlpool.toBase58(),
            tickLowerIndex: positionData.tickLowerIndex,
            tickUpperIndex: positionData.tickUpperIndex,
            liquidity: positionData.liquidity.toString(),
            tokenAAmount: quote.tokenEstA.toString(),
            tokenBAmount: quote.tokenEstB.toString(),
            feeOwedA: positionData.feeOwedA.toString(),
            feeOwedB: positionData.feeOwedB.toString(),
            currentPrice: currentPrice.toFixed(4),
            minPrice: minPrice.toFixed(4),
            maxPrice: maxPrice.toFixed(4),
            inRange,
            poolPair,
            tokenA,
            tokenB
        } as any;
    } catch (error) {
        console.error("Error fetching position details:", error);
        throw error;
    }
}
