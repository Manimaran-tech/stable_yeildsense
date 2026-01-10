import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { WalletContextProvider } from './providers/WalletContextProvider';
import { RealtimeProvider } from './context/RealtimeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@solana/wallet-adapter-react-ui/styles.css';

// Lazy load pages to prevent SDK initialization issues during import
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TradingPage = lazy(() => import('./components/swap/TradingPage'));

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading...</div>
        </div>
    );
}

function App() {
    console.log('App: Rendering...');

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <WalletContextProvider>
                    <RealtimeProvider>
                        <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 relative">
                            {/* Blurred Orbs */}
                            <div className="bg-orb orb-1"></div>
                            <div className="bg-orb orb-2"></div>

                            <div className="relative z-10">
                                <Navbar />
                                <main className="container mx-auto px-4 py-8 pb-24">
                                    <Suspense fallback={<LoadingFallback />}>
                                        <Routes>
                                            <Route path="/" element={<Dashboard />} />
                                            <Route path="/trade" element={<TradingPage />} />
                                        </Routes>
                                    </Suspense>
                                </main>
                            </div>
                        </div>
                    </RealtimeProvider>
                </WalletContextProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;
