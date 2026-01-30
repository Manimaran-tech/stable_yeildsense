import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, MousePointer2, Sparkles, Lock, Eye } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '../styles/landing.css';
import { TextReveal } from './ui/TextReveal';
import { HolographicBoard } from './ui/HolographicBoard';
import { BlockchainBackground } from './ui/BlockchainBackground';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Observer for scroll-reveal animations
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            },
            { threshold: 0.1 }
        );

        document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const handleEnterDashboard = () => {
        navigate('/dashboard');
    };

    return (
        <motion.div
            ref={containerRef}
            className="landing-container text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Blockchain Animated Background */}
            <BlockchainBackground showCursorGlow={true} opacity={1} />

            {/* Entry Button */}
            <motion.button
                className="btn-visit"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                onClick={handleEnterDashboard}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <Sparkles className="w-4 h-4 inline mr-2" />
                Visit Website
            </motion.button>

            {/* Hero Section */}
            <section className="hero-3d relative z-10 pt-20">
                {/* Floating Particles */}
                <motion.div
                    className="absolute top-1/4 left-1/4 w-4 h-4 rounded-full bg-purple-500/50"
                    animate={{
                        y: [0, -20, 0],
                        x: [0, 10, 0],
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                    className="absolute top-1/3 right-1/4 w-3 h-3 rounded-full bg-cyan-400/50"
                    animate={{
                        y: [0, 15, 0],
                        x: [0, -15, 0],
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0.8, 0.4]
                    }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
                <motion.div
                    className="absolute bottom-1/3 left-1/3 w-2 h-2 rounded-full bg-pink-500/50"
                    animate={{
                        y: [0, -25, 0],
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 0.7, 0.3]
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                />

                <motion.div
                    className="floating-card text-center"
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                >
                    <motion.div
                        animate={{ y: [0, -10, 0], rotateY: [0, 5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <div className="relative inline-block">
                            <img
                                src="/logo2.png"
                                alt="YieldSense Logo"
                                className="w-32 h-32 mx-auto mb-6 object-contain drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]"
                            />
                            <motion.div
                                className="absolute -inset-10 rounded-full bg-purple-500/20 blur-2xl"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />
                        </div>
                    </motion.div>

                    <div className="mb-6">
                        <TextReveal className="text-7xl font-black yield-sense-gradient-text" blockColor="#00F0FF" delay={0.2}>
                            YIELD SENSE
                        </TextReveal>
                    </div>

                    <div className="mb-10 px-6">
                        <TextReveal className="text-xl text-gray-300 leading-relaxed" blockColor="#8b5cf6" delay={0.6}>
                            <span>
                                Experience the <span className="text-purple-400 font-semibold">first fully private</span> CLMM yield optimizer on Solana.
                            </span>
                        </TextReveal>
                        <br />
                        <TextReveal className="text-xl text-gray-300 leading-relaxed mt-1" blockColor="#00F0FF" delay={0.8}>
                            <span>
                                <span className="text-cyan-400 font-semibold">Advanced Encryption • Proactive Asset Protection</span>
                            </span>
                        </TextReveal>
                    </div>

                    <motion.div
                        className="flex items-center justify-center gap-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7, duration: 0.8 }}
                    >
                        <div className="scale-110">
                            <WalletMultiButton />
                        </div>
                    </motion.div>

                    <motion.div
                        className="mt-14 text-gray-400 flex flex-col items-center gap-3"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <span className="text-sm uppercase tracking-[0.2em] font-bold">Scroll to Explore</span>
                        <MousePointer2 className="w-5 h-5 text-purple-400" />
                    </motion.div>
                </motion.div>
            </section>

            {/* Features Section */}
            <section className="section-immersive">
                <div className="reveal max-w-4xl text-center mb-12">
                    <TextReveal className="text-5xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent" blockColor="#F0F0F0">
                        Financial Privacy, Reimagined.
                    </TextReveal>
                    <div className="mt-4">
                        <TextReveal className="text-lg text-gray-400 leading-relaxed" blockColor="#8b5cf6">
                            <span>Yield Sense utilizes <span className="text-purple-400">Military-Grade Encryption</span> to decouple your identity from your liquidity positions.</span>
                        </TextReveal>
                    </div>
                </div>

                <div className="feature-grid cursor-default">
                    <motion.div
                        className="feature-card reveal relative"
                        whileHover={{ rotateY: 5, rotateX: -5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <span className="step-number">01</span>
                        <div className="relative inline-block mb-4">
                            <Zap className="text-yellow-400 w-12 h-12" />
                            <motion.div
                                className="absolute -inset-2 rounded-full bg-yellow-500/20 blur-lg"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-white">Automated Yield</h3>
                        <p className="text-gray-400 leading-relaxed">Smart rebalancing across Whirlpool CLMM ranges to maximize your auto-compounding returns.</p>
                    </motion.div>

                    <motion.div
                        className="feature-card reveal relative"
                        whileHover={{ rotateY: -5, rotateX: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <span className="step-number">02</span>
                        <div className="relative inline-block mb-4">
                            <Lock className="text-purple-400 w-12 h-12" />
                            <motion.div
                                className="absolute -inset-2 rounded-full bg-purple-500/20 blur-lg"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-white">Encryption Protected</h3>
                        <p className="text-gray-400 leading-relaxed">Your deposit amounts and profit ratios are shielded on-chain using advanced cryptographic protection.</p>
                    </motion.div>

                    <motion.div
                        className="feature-card reveal relative"
                        whileHover={{ rotateY: 5, rotateX: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                    >
                        <span className="step-number">03</span>
                        <div className="relative inline-block mb-4">
                            <Eye className="text-cyan-400 w-12 h-12" />
                            <motion.div
                                className="absolute -inset-2 rounded-full bg-cyan-500/20 blur-lg"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                            />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-white">Privacy Routing</h3>
                        <p className="text-gray-400 leading-relaxed">Multi-wallet indirection and timing obfuscation prevent on-chain heuristics from tracking your activity.</p>
                    </motion.div>
                </div>
            </section>

            {/* Steps Section */}
            <section className="section-immersive bg-gradient-to-b from-transparent via-purple-950/10 to-transparent">
                <div className="reveal text-center mb-16">
                    <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-300 via-white to-purple-300 bg-clip-text text-transparent">
                        How to Get Started
                    </h2>
                </div>

                <div className="max-w-5xl w-full grid md:grid-cols-2 gap-12 items-center px-6">
                    <div className="space-y-12">
                        {[
                            { title: "Connect Wallet", desc: "Link your Phantom or Solflare wallet securely on the landing page or dashboard.", icon: "🔗" },
                            { title: "Encrypted Deposit", desc: "Select a pool. Your liquidity is encrypted locally before being routed through our privacy layer.", icon: "🔒" },
                            { title: "Earn & Reveal", desc: "Monitor your yield in total privacy. Only you can unveil your true balance using attested decryption.", icon: "💎" }
                        ].map((step, i) => (
                            <motion.div
                                key={i}
                                className="reveal flex gap-6"
                                whileHover={{ x: 15, scale: 1.02 }}
                                transition={{ type: "spring", stiffness: 300 }}
                            >
                                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-500/30 to-cyan-500/30 rounded-2xl flex items-center justify-center border border-purple-500/30 text-2xl shadow-lg shadow-purple-500/20">
                                    {step.icon}
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold mb-2 text-white">{step.title}</h4>
                                    <p className="text-gray-400 leading-relaxed">{step.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="reveal relative w-full aspect-square flex items-center justify-center">
                        <HolographicBoard />
                    </div>
                </div>
            </section>

            {/* Footer / CTA Section */}
            <section className="section-immersive text-center">
                <div className="reveal mb-12 flex flex-col items-center gap-10">
                    <TextReveal className="text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent" blockColor="#00F0FF">
                        READY TO ENTER?
                    </TextReveal>
                    <motion.button
                        className="px-14 py-6 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white text-xl font-black rounded-2xl transition-all shadow-2xl shadow-purple-500/30"
                        whileHover={{ scale: 1.08, boxShadow: "0 0 60px rgba(139, 92, 246, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleEnterDashboard}
                    >
                        <Sparkles className="w-6 h-6 inline mr-3" />
                        LAUNCH APP
                    </motion.button>
                </div>

                <p className="text-gray-500 font-mono text-sm tracking-[0.2em] uppercase">
                    Encrypted & Protected by Whirlpool Privacy Layer
                </p>
            </section>
        </motion.div>
    );
};

export default LandingPage;
