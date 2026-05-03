export default function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-40 left-1/4 w-[300px] h-[300px] rounded-full bg-sky/5 blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
          <span className="font-mono text-xs text-accent tracking-widest uppercase">Built on Solana Devnet</span>
        </div>

        <h1 className="font-display text-6xl md:text-8xl tracking-widest mb-6 leading-none">
          <span className="shimmer-text">PREDICT.</span>
          <br />
          <span className="text-white">EARN. GOVERN.</span>
        </h1>

        <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed mb-10">
          OracleX is a decentralized prediction marketplace on Solana. Bet on token price movements
          using live Pyth oracle data, or predict real-world events resolved transparently by our DAO.
        </p>

        <div className="flex flex-wrap justify-center gap-6">
          <div className="flex items-start gap-3 text-left max-w-xs p-4 rounded-xl bg-panel border border-border">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">Price Markets</p>
              <p className="text-xs text-muted">Trade positions on ETH, BTC, SOL prices using real-time Pyth oracle feeds.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-left max-w-xs p-4 rounded-xl bg-panel border border-border">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-1">Event Markets</p>
              <p className="text-xs text-muted">Predict real-world outcomes resolved by our on-chain DAO governance system.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}