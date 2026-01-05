import { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    TickArrayUtil,
    PDAUtil,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PriceMath,
    TICK_ARRAY_SIZE
} from "@orca-so/whirlpools-sdk";
import { Wallet, BN } from "@coral-xyz/anchor";

export async function getLiquidityDistribution(req: Request, res: Response) {
    const { address } = req.params;

    if (!address) {
        return res.status(400).json({ error: "Pool address is required" });
    }

    try {
        const connection = getConnection();
        const dummyWallet = new Wallet({
            publicKey: PublicKey.default,
            secretKey: new Uint8Array(64),
        } as any);
        const ctx = WhirlpoolContext.from(connection, dummyWallet);
        const client = buildWhirlpoolClient(ctx);

        const poolPubkey = new PublicKey(address);
        const pool = await client.getPool(poolPubkey);
        const data = pool.getData();

        // Get current tick
        const currentTick = data.tickCurrentIndex;
        const tickSpacing = data.tickSpacing;

        // Calculate start tick index for the tick array containing the current tick
        // TickArray logic: startTickIndex = Math.floor(tick / (tickSpacing * TICK_ARRAY_SIZE)) * (tickSpacing * TICK_ARRAY_SIZE)
        const ticksInArray = tickSpacing * TICK_ARRAY_SIZE;
        const tickArrayStartTick = Math.floor(currentTick / ticksInArray) * ticksInArray;

        // Fetch 11 tick arrays (+/- 5 from current) to get wider coverage for all pool types
        // Expanded range for pools with low-value tokens (PENGU) or pegged assets (JupSOL/SOL)
        const pdas = [];
        for (let i = -5; i <= 5; i++) {
            const startTick = tickArrayStartTick + (i * ticksInArray);
            pdas.push(PDAUtil.getTickArray(ctx.program.programId, poolPubkey, startTick).publicKey);
        }
        console.log(`[getLiquidityDistribution] Fetching ${pdas.length} tick arrays for pool ${address}`);

        // Use getTickArrays (correct method name per lint/docs usually)
        const tickArrays = await ctx.fetcher.getTickArrays(pdas); // Default fetch options

        // Process tick arrays into a simplified format
        const liquidityDistribution: { tick: number; liquidity: string; price: number }[] = [];
        const tokenA = pool.getTokenAInfo();
        const tokenB = pool.getTokenBInfo();

        tickArrays.forEach(ta => {
            if (!ta) return;
            ta.ticks.forEach((tick, i) => {
                if (!tick.initialized) return;

                // Calculate tick index based on array start + offset
                const tickIndex = ta.startTickIndex + (i * tickSpacing);

                // Calculate price for this tick
                const price = PriceMath.tickIndexToPrice(
                    tickIndex,
                    tokenA.decimals,
                    tokenB.decimals
                );

                liquidityDistribution.push({
                    tick: tickIndex,
                    liquidity: tick.liquidityGross.toString(),
                    price: parseFloat(price.toFixed(6))
                });
            });
        });

        // Sort by tick index
        liquidityDistribution.sort((a, b) => a.tick - b.tick);

        res.json({
            currentPrice: PriceMath.sqrtPriceX64ToPrice(data.sqrtPrice, tokenA.decimals, tokenB.decimals).toFixed(6),
            currentTick: currentTick,
            distribution: liquidityDistribution
        });

    } catch (error: any) {
        console.error("Error fetching liquidity distribution:", error);
        res.status(500).json({ error: error.message });
    }
}
