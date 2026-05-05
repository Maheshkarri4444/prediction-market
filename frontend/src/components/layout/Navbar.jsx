import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link, useLocation } from "react-router-dom";
import { shortenAddress } from "../../utils/formatters";

export default function Navbar() {
  const { publicKey, connected } = useWallet();
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-void/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-lg bg-accent/20 group-hover:bg-accent/30 transition-all duration-300" />
            <div className="absolute inset-1 rounded-md bg-accent/40" />
            <svg className="absolute inset-0 w-full h-full p-1.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span className="font-display text-2xl tracking-widest text-white">
            PREDICT<span className="text-accent">X</span>
          </span>
        </Link>



        <div className="flex items-center gap-3">
          {connected && publicKey && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel border border-border">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
              <span className="font-mono text-xs text-muted">{shortenAddress(publicKey.toBase58())}</span>
            </div>
          )}
          <WalletMultiButton style={{
            background: connected ? "#00ff88" : "transparent",
            border: "1px solid #1e1e2e",
            borderRadius: "12px",
            color: connected ? "#050508" : "#e0e0f0",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            padding: "8px 16px",
            height: "auto",
            lineHeight: "normal",
          }} />
        </div>
      </div>
    </nav>
  );
}