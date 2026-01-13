// Simple Percentage class for frontend use (no external dependencies)
export class Percentage {
    numerator: bigint;
    denominator: bigint;

    constructor(n: bigint | number, d: bigint | number) {
        this.numerator = BigInt(n);
        this.denominator = BigInt(d);
    }

    static fromFraction(numerator: number | bigint, denominator: number | bigint): Percentage {
        return new Percentage(BigInt(numerator), BigInt(denominator));
    }

    toString(): string {
        return `${this.numerator.toString()}/${this.denominator.toString()}`;
    }
}

