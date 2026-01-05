import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    PriceMath
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";
import { PoolInfo } from "./getPool.js";

export async function getPools(poolAddresses: string[]): Promise<(PoolInfo | null)[]> {
    const connection = getConnection();
    const dummyWallet = new Wallet({
        publicKey: PublicKey.default,
        secretKey: new Uint8Array(64),
    } as any);

    const ctx = WhirlpoolContext.from(
        connection,
        dummyWallet
    );

    // Batch fetch pools
    const pubkeys = poolAddresses.map(a => new PublicKey(a));
    console.log(`[getPools] Batch fetching ${pubkeys.length} pools...`);

    // 1. Fetch all pool accounts in one go. Returns a Map.
    // Argument is IGNORE_CACHE? Or options. Passing nothing uses default.
    const poolsMap = await ctx.fetcher.getPools(pubkeys);

    // 2. Collect all unique mints needed
    const mintsToFetch = new Set<string>();
    poolsMap.forEach((p) => {
        if (p) {
            mintsToFetch.add(p.tokenMintA.toBase58());
            mintsToFetch.add(p.tokenMintB.toBase58());
        }
    });

    const mintPubkeys = Array.from(mintsToFetch).map(m => new PublicKey(m));
    console.log(`[getPools] Batch fetching ${mintPubkeys.length} mints...`);

    // 3. Fetch all mint infos in one go (populates the cache)
    if (mintPubkeys.length > 0) {
        await ctx.fetcher.getMintInfos(mintPubkeys);
    }

    // 4. Assemble results using Promise.all to await async cache lookups
    // Iterate over INPUT pubkeys to maintain order
    const results = await Promise.all(pubkeys.map(async (key, i) => {
        const data = poolsMap.get(key.toBase58());
        if (!data) return null;

        // Fetcher caches the results from listMintInfos, so these requests hit the cache
        const tokenAInfo = await ctx.fetcher.getMintInfo(data.tokenMintA);
        const tokenBInfo = await ctx.fetcher.getMintInfo(data.tokenMintB);

        if (!tokenAInfo || !tokenBInfo) {
            console.warn(`[getPools] Missing mint info for pool ${poolAddresses[i]}`);
            return null;
        }

        const price = PriceMath.sqrtPriceX64ToPrice(
            data.sqrtPrice,
            tokenAInfo.decimals,
            tokenBInfo.decimals
        );

        return {
            address: poolAddresses[i],
            tokenA: data.tokenMintA.toBase58(),
            tokenB: data.tokenMintB.toBase58(),
            liquidity: data.liquidity.toString(),
            price: price.toFixed(6),
            tickSpacing: data.tickSpacing,
            feeTier: data.feeRate / 10000 / 100
        };
    }));

    return results;
}
