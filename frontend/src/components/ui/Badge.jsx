const variants = {
  accent: "bg-accent/10 text-accent border border-accent/20",
  gold: "bg-gold/10 text-gold border border-gold/20",
  crimson: "bg-crimson/10 text-crimson border border-crimson/20",
  sky: "bg-sky/10 text-sky border border-sky/20",
  muted: "bg-dim text-muted border border-border",
};

export default function Badge({ children, variant = "accent", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}