import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen grid-bg flex items-center justify-center px-6">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-gold/5 blur-[140px] pointer-events-none" />

      <div className="relative z-10 text-center max-w-lg">
        {/* Big 404 */}
        <div className="relative mb-6 select-none">
          <span className="font-display text-[10rem] leading-none font-bold text-white/[0.04] tracking-widest pointer-events-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-6xl font-bold tracking-[0.3em] text-gold">
              404
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/30" />
          <span className="text-[10px] font-mono text-gold/60 uppercase tracking-[0.3em]">
            Page Not Found
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/30" />
        </div>

        {/* Message */}
        <p className="text-white/50 font-mono text-sm leading-relaxed mb-10">
          The page you're looking for doesn't exist or has been moved.
          <br />
          Head back to a known location.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3 rounded-xl bg-gold text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-gold/90 transition-all duration-200"
          >
            Go Home
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 rounded-xl border border-border bg-panel text-white/50 font-mono text-sm uppercase tracking-widest hover:text-white hover:border-gold/30 transition-all duration-200"
          >
            Go Back
          </button>
        </div>

        {/* Quick links */}
        <div className="mt-12 flex items-center justify-center gap-6 flex-wrap">
          {[
            { label: "Marketplace", path: "/marketplace" },
            { label: "DAO", path: "/dao" },
            { label: "Register", path: "/register" },
          ].map(({ label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="text-xs font-mono text-white/25 hover:text-gold transition-colors duration-150"
            >
              {label} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}