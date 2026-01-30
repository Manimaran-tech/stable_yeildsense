import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { mlApi } from '../api';
import { mapPoolTokens } from '../utils/tokenMapping';

interface TokenNewsPanelProps {
    tokenA: string;
    tokenB: string;
    isOpen: boolean;
}

interface HeadlineItem {
    headline: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
}

interface NewsData {
    trend: 'bullish' | 'bearish' | 'neutral';
    net_sentiment: number;
    confidence: number;
    headlines: HeadlineItem[];
}

const SentimentIcon: FC<{ sentiment: string }> = ({ sentiment }) => {
    switch (sentiment) {
        case 'positive':
            return <TrendingUp size={14} className="text-green-400" />;
        case 'negative':
            return <TrendingDown size={14} className="text-red-400" />;
        default:
            return <Minus size={14} className="text-yellow-400" />;
    }
};

export const TokenNewsPanel: FC<TokenNewsPanelProps> = ({ tokenA, tokenB, isOpen }) => {
    const [loading, setLoading] = useState(true);
    const [newsA, setNewsA] = useState<NewsData | null>(null);
    const [newsB, setNewsB] = useState<NewsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchNews = async () => {
            setLoading(true);
            setError(null);

            try {
                const mapping = mapPoolTokens(tokenA, tokenB);

                // Fetch news for both tokens in parallel
                const [resultA, resultB] = await Promise.all([
                    mapping.mlTokenA ? mlApi.getTokenNews(mapping.mlTokenA) : null,
                    mapping.mlTokenB ? mlApi.getTokenNews(mapping.mlTokenB) : null
                ]);

                if (resultA?.success) {
                    setNewsA({
                        trend: resultA.sentiment.trend,
                        net_sentiment: resultA.sentiment.net_sentiment,
                        confidence: resultA.sentiment.confidence,
                        headlines: resultA.sentiment.headlines || []
                    });
                }

                if (resultB?.success) {
                    setNewsB({
                        trend: resultB.sentiment.trend,
                        net_sentiment: resultB.sentiment.net_sentiment,
                        confidence: resultB.sentiment.confidence,
                        headlines: resultB.sentiment.headlines || []
                    });
                }
            } catch (e) {
                console.error('News fetch error:', e);
                setError('Could not load news');
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [isOpen, tokenA, tokenB]);

    if (!isOpen) return null;

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'bullish': return 'text-green-400 bg-green-500/20';
            case 'bearish': return 'text-red-400 bg-red-500/20';
            default: return 'text-yellow-400 bg-yellow-500/20';
        }
    };

    const renderNewsSection = (token: string, news: NewsData | null) => {
        if (!news) {
            return (
                <div className="text-xs text-muted-foreground text-center py-2">
                    No news available for {token}
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {/* Token Header with Trend */}
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{token}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getTrendColor(news.trend)}`}>
                        {news.trend}
                    </span>
                </div>

                {/* Headlines */}
                {news.headlines.length > 0 ? (
                    <div className="space-y-1.5">
                        {news.headlines.slice(0, 3).map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <SentimentIcon sentiment={item.sentiment} />
                                <p className="text-xs text-foreground/90 line-clamp-2 flex-1">
                                    {item.headline}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground text-center py-2 bg-muted/20 rounded-lg">
                        No recent headlines
                    </div>
                )}

                {/* Sentiment Score */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-[#1e293b]">
                    <span>Sentiment Score</span>
                    <span className={`font-mono ${news.net_sentiment > 0 ? 'text-green-400' : news.net_sentiment < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {news.net_sentiment > 0 ? '+' : ''}{(news.net_sentiment * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Newspaper size={16} className="text-primary" />
                <h4 className="text-sm font-semibold">Market News</h4>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={24} />
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                    {error}
                </div>
            ) : (
                <div className="flex-1 space-y-4 overflow-y-auto">
                    {/* Token A News */}
                    <div className="bg-[#1e293b] rounded-xl p-3">
                        {renderNewsSection(tokenA, newsA)}
                    </div>

                    {/* Token B News */}
                    <div className="bg-[#1e293b] rounded-xl p-3">
                        {renderNewsSection(tokenB, newsB)}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-[#1e293b]">
                Powered by FinBERT Sentiment
            </div>
        </div>
    );
};

export default TokenNewsPanel;
