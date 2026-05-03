import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import HeroSection from "../components/home/HeroSection";
import MarketplaceStats from "../components/home/MarketplaceStats";
import MarketsFeed from "../components/home/MarketsFeed";
import { useCheckUser } from "../hooks/useCheckUser";
import Spinner from "../components/ui/Spinner";

export default function Home() {
  const navigate = useNavigate();
  const { connected, wallet } = useWallet();
  const { status } = useCheckUser();

  useEffect(() => {
    if (status === "normal") navigate("/marketplace");
    else if (status === "dao") navigate("/dao");
    else if (status === "none") navigate("/register");
  }, [status, navigate]);

  return (
    <div className="relative min-h-screen grid-bg">
      <HeroSection />
      <MarketplaceStats />
      <MarketsFeed />

      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="p-10 rounded-3xl bg-panel border border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
          {connected && status === "checking" ? (
            <div className="flex flex-col items-center gap-4 relative z-10">
              <Spinner size="lg" />
              <p className="text-muted text-sm">Checking your account…</p>
            </div>
          ) : connected ? null : (
            <div className="relative z-10">
              <h2 className="font-display text-4xl tracking-widest text-white mb-3">
                JOIN THE <span className="text-accent">MARKET</span>
              </h2>
              <p className="text-muted text-sm mb-8 max-w-md mx-auto">
                Connect your Phantom wallet to participate in prediction markets, stake on outcomes, and earn rewards.
              </p>
              <WalletMultiButton style={{
                background: "#00ff88",
                border: "none",
                borderRadius: "12px",
                color: "#FFFFFF",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "15px",
                fontWeight: 700,
                padding: "14px 32px",
                height: "auto",
                boxShadow: "0 0 20px rgba(0,255,136,0.3)",
              }} />
              <p className="text-xs text-muted mt-4">Only Phantom wallet supported • Devnet only</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}