import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";
import { DAO_CREATION_FEE } from "../constants";

export default function Register() {
  const navigate = useNavigate();
  const { connected } = useWallet();

  useEffect(() => {
    if (!connected) navigate("/");
  }, [connected, navigate]);

  return (
    <div className="relative min-h-screen grid-bg flex items-center justify-center px-6">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-12">
          <span className="inline-block font-mono text-xs text-accent tracking-widest uppercase px-3 py-1 rounded-full border border-accent/20 bg-accent/5 mb-4">
            New Member
          </span>
          <h1 className="font-display text-5xl tracking-widest text-white mb-3">
            CHOOSE YOUR <span className="text-accent">ROLE</span>
          </h1>
          <p className="text-muted text-sm">Select how you want to participate in OracleX prediction markets.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button onClick={() => navigate("/register/user")}
            className="group text-left p-7 rounded-2xl bg-panel border border-border hover:border-accent/40 hover:shadow-glow transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className="font-display text-2xl tracking-widest text-white mb-2 group-hover:text-accent transition-colors">TRADER</h2>
            <p className="text-sm text-muted leading-relaxed mb-5">Participate in price markets and event markets. Place bets, track positions, and claim rewards.</p>
            <span className="text-xs font-mono text-accent px-2 py-1 rounded-lg bg-accent/10 border border-accent/20">Free to join</span>
          </button>

          <button onClick={() => navigate("/register/dao")}
            className="group text-left p-7 rounded-2xl bg-panel border border-border hover:border-gold/40 hover:shadow-glow-gold transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <h2 className="font-display text-2xl tracking-widest text-white mb-2 group-hover:text-gold transition-colors">DAO MEMBER</h2>
            <p className="text-sm text-muted leading-relaxed mb-5">Govern event market resolutions. Stake SOL, vote on outcomes, and earn rewards for correct governance.</p>
            <span className="text-xs font-mono text-gold px-2 py-1 rounded-lg bg-gold/10 border border-gold/20">{DAO_CREATION_FEE} SOL fee</span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <button onClick={() => navigate("/")} className="text-xs text-muted hover:text-white transition-colors duration-200 font-mono">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}