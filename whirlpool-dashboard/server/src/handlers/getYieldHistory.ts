import { Request, Response } from "express";

// Mock data generator for yield
// In a real app, this would query a database or external indexer
export async function getYieldHistory(req: Request, res: Response) {
    const { address } = req.params;

    // Generate last 7 days of mock APR data
    // Randomly floating around 12-15%
    const data = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // Base APR 12%, random var +/- 2%
        const apr = 12 + (Math.random() * 4 - 2);

        data.push({
            date: date.toLocaleDateString('en-US', { weekday: 'short' }),
            apr: parseFloat(apr.toFixed(2))
        });
    }

    res.json(data);
}
