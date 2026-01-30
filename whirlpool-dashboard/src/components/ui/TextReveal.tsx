import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface TextRevealProps {
    children: React.ReactNode;
    className?: string;
    blockColor?: string;
    delay?: number;
}

export const TextReveal: React.FC<TextRevealProps> = ({
    children,
    className = '',
    blockColor = '#8b5cf6',
    delay = 0
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [hasRevealed, setHasRevealed] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasRevealed) {
                    setIsVisible(true);
                    setHasRevealed(true);
                }
            },
            { threshold: 0.3 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [hasRevealed]);

    return (
        <div ref={ref} className={`relative inline-block overflow-hidden ${className}`}>
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: isVisible ? 1 : 0 }}
                transition={{ duration: 0.5, delay: delay + 0.3 }}
            >
                {children}
            </motion.span>

            {/* Reveal Block */}
            <motion.div
                style={{ backgroundColor: blockColor }}
                className="absolute inset-0"
                initial={{ scaleX: 0, originX: 0 }}
                animate={isVisible ? {
                    scaleX: [0, 1, 1, 0],
                    originX: [0, 0, 1, 1]
                } : { scaleX: 0 }}
                transition={{
                    duration: 0.8,
                    delay: delay,
                    times: [0, 0.4, 0.6, 1],
                    ease: 'easeInOut'
                }}
            />
        </div>
    );
};

export default TextReveal;
