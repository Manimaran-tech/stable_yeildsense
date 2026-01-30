import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Lock } from 'lucide-react';

export const HolographicBoard: React.FC = () => {
    return (
        <div className="holographic-container">
            <motion.div
                className="holographic-board"
                animate={{
                    rotateY: [0, 10, 0, -10, 0],
                    rotateX: [0, -5, 0, 5, 0]
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: 'easeInOut'
                }}
            >
                {/* Inner Content */}
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <motion.div
                        className="p-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Shield className="w-12 h-12 text-purple-400" />
                    </motion.div>

                    <div className="text-center">
                        <p className="text-lg font-bold text-white mb-1">Privacy First</p>
                        <p className="text-sm text-gray-400">FHE Protected</p>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <motion.div
                            className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                        >
                            <Zap className="w-5 h-5 text-yellow-400" />
                        </motion.div>
                        <motion.div
                            className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                        >
                            <Lock className="w-5 h-5 text-cyan-400" />
                        </motion.div>
                    </div>
                </div>

                {/* Floating Particles */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                            background: i % 2 === 0 ? '#8b5cf6' : '#06b6d4',
                            left: `${20 + (i * 12)}%`,
                            top: `${20 + (i * 10)}%`,
                        }}
                        animate={{
                            y: [0, -20, 0],
                            opacity: [0.3, 0.8, 0.3],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{
                            duration: 2 + i * 0.5,
                            repeat: Infinity,
                            delay: i * 0.2
                        }}
                    />
                ))}

                {/* Glow Effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/5 to-cyan-500/5 blur-xl" />
            </motion.div>
        </div>
    );
};

export default HolographicBoard;
