import React from 'react';

interface ChartCardProps {
    title: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerRight?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, children, className = '', headerRight }) => {
    return (
        <div className={`bg-[#0a0e1a] rounded-2xl p-6 border border-[#1e293b] shadow-xl overflow-hidden ${className}`}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1e293b]">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></span>
                    {title}
                </h3>
                {headerRight && <div>{headerRight}</div>}
            </div>
            <div className="w-full h-[300px]">
                {children}
            </div>
        </div>
    );
};
