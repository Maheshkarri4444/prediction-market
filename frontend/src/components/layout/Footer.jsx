export default function Footer() {
  return (
    <footer className="border-t border-border bg-void mt-20">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl tracking-widest text-white">ORACLE<span className="text-accent">X</span></span>
          <span className="text-muted text-sm">— Prediction Markets on Solana Devnet</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <span className="w-2 h-2 rounded-full bg-accent inline-block animate-pulse-slow" />
          Devnet Only
        </div>
      </div>
    </footer>
  );
}