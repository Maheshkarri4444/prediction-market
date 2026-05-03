import { useNavigate } from "react-router-dom";
import { DAO_CREATION_FEE } from "../constants";

export default function RegisterDaoUser() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen grid-bg flex items-center justify-center px-6">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/20 bg-gold/5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-slow" />
          <span className="font-mono text-xs text-gold tracking-widest uppercase">Under Development</span>
        </div>
        <h1 className="font-display text-4xl tracking-widest text-white mb-4">DAO <span className="text-gold">ONBOARDING</span></h1>
        <p className="text-muted text-sm leading-relaxed mb-3 max-w-sm mx-auto">
          DAO member registration is currently being built. DAO members stake{" "}
          <span className="text-gold font-mono font-semibold">{DAO_CREATION_FEE} SOL</span> to join and vote on event market resolutions.
        </p>
        <p className="text-muted/60 text-xs mb-10 font-mono">Check back soon — governance features are coming.</p>
        <button onClick={() => navigate("/register")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border bg-panel text-white text-sm hover:border-gold/40 hover:text-gold transition-all duration-200">
          ← Back to Role Selection
        </button>
      </div>
    </div>
  );
}