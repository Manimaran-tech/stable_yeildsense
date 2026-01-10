import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Loader2, Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { mlApi } from '../api';
import { mapPoolTokens } from '../utils/tokenMapping';

interface NewsPanelProps {
    tokenA: string;
    tokenB: string;
    isOpen: boolean;
}

type SentimentTrend = 'bullish' | 'bearish' | 'neutral';

interface HeadlineItem {
    headline: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
}

/**
 * Trend indicator component
 */
const TrendIndicator: FC<{ trend: SentimentTrend }> = ({ trend }) => {
    const config = {
        bullish: {
            icon: <TrendingUp size={24} />,
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            borderColor: 'border-green-500/30',
            label: 'Bullish'
        },
        bearish: {
            icon: <TrendingDown size={24} />,
            color: 'text-red-400',
            bgColor: 'bg-red-500/20',
            borderColor: 'border-red-500/30',
            label: 'Bearish'
        },
        neutral: {
            icon: <Minus size={24} />,
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/20',
            borderColor: 'border-yellow-500/30',
            label: 'Neutral'
        }
    };

    const { icon, color, bgColor, borderColor, label } = config[trend];

    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${bgColor} border ${borderColor}`}>
            <span className={color}>{icon}</span>
            <span className={`font-semibold ${color}`}>{label}</span>
        </div>
    );
};

/**
 * Main News Panel Component
 */
export const NewsPanel: FC<NewsPanelProps> = ({ tokenA, tokenB, isOpen }) => {
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState<string | null>(null);
    const [sentiment, setSentiment] = useState<{
        trend: SentimentTrend;
        score: number;
        headlines: HeadlineItem[];
    } | null>(null);

    const tokenMapping = mapPoolTokens(tokenA, tokenB);

    useEffect(() => {
        if (!isOpen) return;

        const fetchNews = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch news for primary token
                if (tokenMapping.mlTokenA) {
                    const result = await mlApi.getTokenNews(tokenMapping.mlTokenA);
                    if (result.success && result.news_available) {
                        setSentiment({
                            trend: result.sentiment.trend,
                            score: result.sentiment.net_sentiment,
                            headlines: result.sentiment.headlines
                        });
                    } else {
                        // No news available - show neutral
                        setSentiment({
                            trend: 'neutral',
                            score: 0,
                            headlines: []
                        });
                    }
                } else {
                    setSentiment({
                        trend: 'neutral',
                        score: 0,
                        headlines: []
                    });
                }
            } catch (err) {
                console.error('News fetch error:', err);
                // On error, show neutral sentiment
                setSentiment({
                    trend: 'neutral',
                    score: 0,
                    headlines: []
                });
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [isOpen, tokenMapping.mlTokenA]);

    if (!isOpen) return null;

    // Loading state
    if (loading) {
        return (
            <div className="bg-card/50 border border-border rounded-xl p-4">
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="animate-spin text-primary mr-2" size={18} />
                    <span className="text-sm text-muted-foreground">Loading sentiment...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-card/80 to-card/40 border border-border rounded-xl p-4 space-y-3 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Newspaper size={16} className="text-primary" />
                <h4 className="text-sm font-semibold">Market Sentiment</h4>
            </div>

            {/* Trend Indicator */}
            <div className="flex justify-start">
                <TrendIndicator trend={sentiment?.trend || 'neutral'} />
            </div>

            {/* No news message */}
            {(!sentiment?.headlines || sentiment.headlines.length === 0) && (
                <p className="text-xs text-muted-foreground text-center">
                    No recent news for this token pair
                </p>
            )}

            {/* Headlines if available */}
            {sentiment?.headlines && sentiment.headlines.length > 0 && (
                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                    {sentiment.headlines.slice(0, 3).map((item, i) => (
                        <div key={i} className="bg-muted/30 rounded p-2 text-xs">
                            <p className="line-clamp-2">{item.headline}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
                Powered by FinBERT
            </div>
        </div>
    );
};

export default NewsPanel;
