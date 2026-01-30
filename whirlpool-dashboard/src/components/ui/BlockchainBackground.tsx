import React, { useEffect, useState } from 'react';

// Transaction line configuration
const txLines = [
    // Horizontal lines
    { type: 'horizontal', top: '15%', delay: '0s' },
    { type: 'horizontal', top: '35%', delay: '2s' },
    { type: 'horizontal', top: '55%', delay: '4s' },
    { type: 'horizontal', top: '75%', delay: '6s' },
    { type: 'horizontal', top: '90%', delay: '1s' },
    // Horizontal reverse
    { type: 'horizontal-reverse', top: '25%', delay: '1.5s' },
    { type: 'horizontal-reverse', top: '45%', delay: '3.5s' },
    { type: 'horizontal-reverse', top: '65%', delay: '5.5s' },
    { type: 'horizontal-reverse', top: '85%', delay: '0.5s' },
    // Vertical lines
    { type: 'vertical', left: '10%', delay: '0s' },
    { type: 'vertical', left: '30%', delay: '2.5s' },
    { type: 'vertical', left: '50%', delay: '1s' },
    { type: 'vertical', left: '70%', delay: '3.5s' },
    { type: 'vertical', left: '90%', delay: '0.5s' },
    // Vertical reverse
    { type: 'vertical-reverse', left: '20%', delay: '1.5s' },
    { type: 'vertical-reverse', left: '40%', delay: '3s' },
    { type: 'vertical-reverse', left: '60%', delay: '4.5s' },
    { type: 'vertical-reverse', left: '80%', delay: '2s' },
    // Diagonal lines
    { type: 'diagonal', top: '50%', delay: '0s' },
    { type: 'diagonal', top: '70%', delay: '4s' },
    { type: 'diagonal', top: '30%', delay: '8s' },
];

// Node points configuration
const nodes = [
    { top: '20%', left: '25%', delay: '0s' },
    { top: '40%', left: '75%', delay: '0.5s' },
    { top: '60%', left: '15%', delay: '1s' },
    { top: '80%', left: '85%', delay: '1.5s' },
    { top: '30%', left: '50%', delay: '2s' },
    { top: '70%', left: '35%', delay: '2.5s' },
    { top: '50%', left: '90%', delay: '0.3s' },
    { top: '15%', left: '60%', delay: '1.8s' },
    { top: '85%', left: '45%', delay: '0.8s' },
    { top: '45%', left: '10%', delay: '1.3s' },
];

interface BlockchainBackgroundProps {
    showCursorGlow?: boolean;
    opacity?: number;
}

export const BlockchainBackground: React.FC<BlockchainBackgroundProps> = ({
    showCursorGlow = true,
    opacity = 1
}) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Mouse tracking for cursor glow effect
    useEffect(() => {
        if (!showCursorGlow) return;

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [showCursorGlow]);

    return (
        <>
            {/* Blockchain Animated Background */}
            <div className="blockchain-background" style={{ opacity }}>
                {/* Grid Pattern */}
                <div className="blockchain-grid" />

                {/* Transaction Lines */}
                <div className="transaction-lines">
                    {txLines.map((line, i) => (
                        <div
                            key={i}
                            className={`tx-line ${line.type}`}
                            style={{
                                top: line.top,
                                left: line.left,
                                animationDelay: line.delay,
                            }}
                        />
                    ))}

                    {/* Node Points */}
                    {nodes.map((node, i) => (
                        <div
                            key={`node-${i}`}
                            className="tx-node"
                            style={{
                                top: node.top,
                                left: node.left,
                                animationDelay: node.delay,
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Cursor Glow Effect (follows mouse) */}
            {showCursorGlow && (
                <div
                    className="cursor-glow"
                    style={{
                        left: mousePosition.x,
                        top: mousePosition.y,
                    }}
                />
            )}
        </>
    );
};

export default BlockchainBackground;
