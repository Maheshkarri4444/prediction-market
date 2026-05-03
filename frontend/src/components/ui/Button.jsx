const variants = {
  accent: "bg-accent text-void font-semibold hover:bg-accent-dim shadow-glow hover:shadow-glow transition-all duration-200",
  ghost: "bg-transparent border border-border text-white hover:border-accent hover:text-accent transition-all duration-200",
  danger: "bg-crimson/10 border border-crimson text-crimson hover:bg-crimson hover:text-white transition-all duration-200",
  gold: "bg-gold text-void font-semibold hover:bg-gold-dim shadow-glow-gold transition-all duration-200",
  dim: "bg-dim text-muted hover:text-white hover:bg-border transition-all duration-200",
};
const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-7 py-3.5 text-base rounded-xl",
};

export default function Button({ children, variant = "accent", size = "md", className = "", disabled = false, loading = false, ...props }) {
  return (
    <button
      className={`font-body inline-flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${disabled || loading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}