import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartCard } from './ChartCard';

interface LiquidityData {
    tick: number;
    liquidity: string;
    price: number;
}

interface LiquidityChartProps {
    data?: LiquidityData[];
    loading?: boolean;
}

export const LiquidityChart = ({ data = [], loading }: LiquidityChartProps) => {
    // Filter data to only show relevant range (remove empty tails)
    // "Zoom Lightly": We add a larger buffer (30 ticks) so it's not too cramped
    const nonZeroIndices = data.map((d, i) => Number(d.liquidity) > 0 ? i : -1).filter(i => i !== -1);

    let displayData = data;
    if (nonZeroIndices.length > 0) {
        const buffer = 30; // 30 ticks buffer for "light zoom"
        const minIdx = Math.max(0, nonZeroIndices[0] - buffer);
        const maxIdx = Math.min(data.length - 1, nonZeroIndices[nonZeroIndices.length - 1] + buffer);
        displayData = data.slice(minIdx, maxIdx + 1);
    }

    const midIndex = Math.floor(displayData.length / 2);

    return (
        <ChartCard title="Liquidity Distribution">
            {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={displayData} barCategoryGap={2} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                        <XAxis
                            dataKey="price"
                            stroke="#6b7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => val.toFixed(2)}
                            minTickGap={30}
                            label={{ value: 'Price', position: 'insideBottom', offset: -10, fill: '#6b7280' }}
                        />
                        <YAxis hide />
                        <Tooltip
                            cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#e5e7eb' }}
                        />
                        <Bar dataKey="liquidity" fill="#8b5cf6" radius={[2, 2, 0, 0]}>
                            {displayData.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={Math.abs(index - midIndex) < 5 ? '#ec4899' : '#8b5cf6'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};
