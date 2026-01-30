import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChartCard } from './ChartCard';

interface YieldData {
    date: string;
    apr: number;
}

interface YieldChartProps {
    data?: YieldData[];
    loading?: boolean;
}

export const YieldChart = ({ data = [], loading }: YieldChartProps) => {
    return (
        <ChartCard title="7D Yield (APR)">
            {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#6b7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#6b7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#e5e7eb' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="apr"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};
