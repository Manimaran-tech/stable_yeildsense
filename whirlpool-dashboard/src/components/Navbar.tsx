import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeftRight, Wallet } from 'lucide-react';


export const Navbar = () => {
    const location = useLocation();

    const navLinks = [
        { path: '/dashboard', label: 'Liquidity Pool', icon: Wallet },
        { path: '/trade', label: 'Trade', icon: ArrowLeftRight },
    ];

    return (
        <nav className="border-b border-[#1e293b]/50 bg-[#0a0e1a]/80 backdrop-blur-xl sticky top-0 z-40">
            <div className="w-full px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-4 group">
                        <img src="/logo.png" alt="YieldSense" className="h-14 w-auto object-contain mix-blend-screen transition-transform duration-300 group-hover:scale-105" />
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                            YieldSense
                        </h1>
                    </Link>

                    {/* Vertical Divider */}
                    <div className="h-8 w-[1px] bg-white/10 mx-4 hidden md:block"></div>

                    {/* Nav Links */}
                    <div className="flex items-center gap-2">
                        {navLinks.map(({ path, label, icon: Icon }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-base font-medium transition-all duration-200 border ${location.pathname === path
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]'
                                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon size={20} className={location.pathname === path ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"} />
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <WalletMultiButton className="!bg-gradient-to-r !from-indigo-600 !to-blue-600 hover:!from-indigo-500 hover:!to-blue-500 !rounded-xl !font-bold !h-11 !px-7 !text-base shadow-lg shadow-indigo-500/20 transition-all !border !border-white/10" />
                </div>
            </div>
        </nav>
    );
};
