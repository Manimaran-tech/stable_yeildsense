
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from './ChartCard';

interface PriceData {
    time: number;
    price: number;
}

interface PriceChartProps {
    data?: PriceData[];
    loading?: boolean;
    coinId?: string; // Optional dynamic coin ID to fetch data
    title?: React.ReactNode;
}

const BACKEND_URL = 'https://yieldsense-backend-a8c2.onrender.com';

export const PriceChart = ({ data = [], loading: initialLoading, coinId, title = 'Price History' }: PriceChartProps) => {
    const [timeRange, setTimeRange] = useState('24H');
    const [chartData, setChartData] = useState<PriceData[]>(data);
    const [loading, setLoading] = useState(initialLoading || false);

    // Sync prop data if no coinId provided (legacy mode)
    useEffect(() => {
        if (!coinId) {
            setChartData(data);
            if (initialLoading !== undefined) setLoading(initialLoading);
        }
    }, [data, coinId, initialLoading]);

    // Fetch data if coinId is provided
    useEffect(() => {
        if (!coinId) return;

        // Clear previous data immediately when coinId changes
        setChartData([]);

        const fetchData = async () => {
            setLoading(true);
            try {
                let days = '1';
                switch (timeRange) {
                    case '15M': days = '0.01'; break; // ~15 mins
                    case '1H': days = '0.042'; break; // ~1 hour
                    case '4H': days = '0.17'; break; // ~4 hours
                    case '24H': days = '1'; break;
                    case '7D': days = '7'; break;
                    case '1M': days = '30'; break;
                }

                const response = await fetch(`${BACKEND_URL}/api/market/history?days=${days}&coinId=${coinId}`);
                if (!response.ok) throw new Error('Failed to fetch chart data');
                const result = await response.json();

                // Only set data if it's for the current coinId (avoid race conditions)
                if (result && result.length > 0) {
                    setChartData(result);
                } else {
                    console.warn(`PriceChart: No data returned for ${coinId}`);
                }
            } catch (error) {
                console.error(`PriceChart fetch error for ${coinId}:`, error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Refresh every minute
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [coinId, timeRange]);

    // Format timestamp for display
    const formattedData = chartData.map(item => ({
        ...item,
        timeDisplay: new Date(item.time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }));

    return (
        <ChartCard
            title={title}
            headerRight={
                <div className="flex gap-1 text-xs bg-gray-900/50 p-1 rounded-full border border-gray-700">
                    {['15M', '1H', '4H', '24H', '7D'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 rounded-full transition-all ${timeRange === range
                                ? 'bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/25'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading chart...</span>
                </div>
            ) : formattedData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                    <span className="text-xs">No price data available</span>
                    <span className="text-xs text-gray-500">Try again in a moment</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={formattedData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="timeDisplay"
                            stroke="#4b5563"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={40}
                            tick={{ fill: '#6b7280' }}
                        />
                        <YAxis
                            stroke="#4b5563"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                            tickFormatter={(value) => `$${value.toFixed(2)}`}
                            tick={{ fill: '#6b7280' }}
                            width={50}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                            itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                            labelStyle={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px' }}
                            labelFormatter={(label) => `Time: ${label}`}
                            formatter={(value: number | undefined) => [value ? `$${value.toFixed(4)}` : '', 'Price']}
                        />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#6366f1"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};
