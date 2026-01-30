import { PublicKey } from "@solana/web3.js";
import { getWhirlpoolsProgramId } from "./connection.js";

/**
 * Derive the Position PDA for a given position mint
 * Seeds: ["position", positionMint]
 */
export async function getPositionPda(positionMint: PublicKey): Promise<PublicKey> {
    const programId = new PublicKey(getWhirlpoolsProgramId());

    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), positionMint.toBuffer()],
        programId
    );

    return pda;
}

/**
 * Derive the Whirlpool PDA for given token mints and tick spacing
 */
export async function getWhirlpoolPda(
    whirlpoolsConfig: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    tickSpacing: number
): Promise<PublicKey> {
    const programId = new PublicKey(getWhirlpoolsProgramId());

    const tickSpacingBuffer = Buffer.alloc(2);
    tickSpacingBuffer.writeUInt16LE(tickSpacing);

    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("whirlpool"),
            whirlpoolsConfig.toBuffer(),
            tokenMintA.toBuffer(),
            tokenMintB.toBuffer(),
            tickSpacingBuffer,
        ],
        programId
    );

    return pda;
}
