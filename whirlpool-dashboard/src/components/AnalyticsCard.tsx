import type { FC } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AnalyticsCardProps {
    title: string;
    value: string;
    change?: string;
}

export const AnalyticsCard: FC<AnalyticsCardProps> = ({ title, value, change }) => {
    const isPositive = change?.startsWith('+');

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-muted-foreground text-sm font-medium mb-2">{title}</h3>
            <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-foreground">{value}</span>
                {change && (
                    <div className={`flex items-center text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span className="ml-1">{change}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
