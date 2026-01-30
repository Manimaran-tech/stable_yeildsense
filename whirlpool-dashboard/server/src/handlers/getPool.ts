import { PublicKey } from "@solana/web3.js";
import { getConnection } from "../utils/connection.js";
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PriceMath
} from "@orca-so/whirlpools-sdk";
import { Wallet } from "@coral-xyz/anchor";

export interface PoolInfo {
    address: string;
    tokenA: string;
    tokenB: string;
    liquidity: string;
    price: string;
    tickSpacing: number;
    feeTier: number;
}

export async function getPool(poolAddress: string): Promise<PoolInfo | null> {
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
        console.log(`[getPool] Fetching pool info for address: ${poolAddress}`);
        const poolPubkey = new PublicKey(poolAddress);

        console.log(`[getPool] Created PublicKey: ${poolPubkey.toString()}`);
        const pool = await client.getPool(poolPubkey);
        console.log(`[getPool] Fetched pool object`);

        const data = pool.getData();
        console.log(`[getPool] Got pool data`);
        const tokenA = pool.getTokenAInfo();
        const tokenB = pool.getTokenBInfo();

        const price = PriceMath.sqrtPriceX64ToPrice(
            data.sqrtPrice,
            tokenA.decimals,
            tokenB.decimals
        );

        return {
            address: poolAddress,
            // We return raw mint addresses as tokens here. 
            // The frontend might expect symbols (SOL, USDC) but those are not on-chain in this way.
            // Ideally we'd use a token list, but for now let's just return mints.
            tokenA: data.tokenMintA.toBase58(),
            tokenB: data.tokenMintB.toBase58(),
            liquidity: data.liquidity.toString(),
            price: price.toFixed(6),
            tickSpacing: data.tickSpacing,
            feeTier: data.feeRate / 10000 / 100 // feeRate is out of 1,000,000 usually
        };
    } catch (e) {
        console.error("Error fetching pool:", e);
        return null; // Or throw
    }
}
