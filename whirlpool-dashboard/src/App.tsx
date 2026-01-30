import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { WalletContextProvider } from './providers/WalletContextProvider';
import { RealtimeProvider } from './context/RealtimeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BlockchainBackground } from './components/ui/BlockchainBackground';
import { PageTransition } from './components/ui/PageTransition';
import '@solana/wallet-adapter-react-ui/styles.css';
import './styles/landing.css';

// Lazy load pages to prevent SDK initialization issues during import
const LandingPage = lazy(() => import('./components/LandingPage'));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TradingPage = lazy(() => import('./components/swap/TradingPage'));

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <div className="text-muted-foreground">Loading...</div>
            </div>
        </div>
    );
}

// Wrapper component to access useLocation inside Router
function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Landing page - full screen, no navbar */}
                <Route path="/" element={<LandingPage />} />

                {/* Dashboard with navbar layout */}
                <Route path="/dashboard" element={
                    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 relative">
                        {/* Blockchain Background */}
                        <BlockchainBackground opacity={0.6} showCursorGlow={true} />

                        {/* Blurred Orbs */}
                        <div className="bg-orb orb-1"></div>
                        <div className="bg-orb orb-2"></div>

                        <div className="relative z-10">
                            <Navbar />
                            <PageTransition>
                                <main className="w-full px-4 py-8 pb-24">
                                    <Dashboard />
                                </main>
                            </PageTransition>
                        </div>
                    </div>
                } />

                {/* Trade page with navbar layout */}
                <Route path="/trade" element={
                    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 relative">
                        {/* Blockchain Background */}
                        <BlockchainBackground opacity={0.6} showCursorGlow={true} />

                        {/* Blurred Orbs */}
                        <div className="bg-orb orb-1"></div>
                        <div className="bg-orb orb-2"></div>

                        <div className="relative z-10">
                            <Navbar />
                            <PageTransition>
                                <main className="w-full px-4 py-8 pb-24">
                                    <TradingPage />
                                </main>
                            </PageTransition>
                        </div>
                    </div>
                } />
            </Routes>
        </AnimatePresence>
    );
}

function App() {
    console.log('App: Rendering...');

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <WalletContextProvider>
                    <RealtimeProvider>
                        <Suspense fallback={<LoadingFallback />}>
                            <AnimatedRoutes />
                        </Suspense>
                    </RealtimeProvider>
                </WalletContextProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;
