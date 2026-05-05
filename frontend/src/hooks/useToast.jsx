import { createContext, useCallback, useContext, useRef, useState } from "react";

// ── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ── Provider (render this once, near your app root or page root) ──────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((message, type = "info", duration = 4500) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = {
    error:   (msg, dur) => push(msg, "error",   dur),
    success: (msg, dur) => push(msg, "success", dur),
    info:    (msg, dur) => push(msg, "info",    dur),
    warn:    (msg, dur) => push(msg, "warn",    dur),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return { toast: ctx };
}

// ── Internal stack renderer ───────────────────────────────────────────────────
const ICONS = {
  error:   "⚠",
  success: "✓",
  info:    "ℹ",
  warn:    "⚡",
};

const COLORS = {
  error:   "border-red-500/40 bg-red-500/10 text-red-300",
  success: "border-accent/40 bg-accent/10 text-accent",
  info:    "border-blue-400/40 bg-blue-400/10 text-blue-300",
  warn:    "border-gold/40 bg-gold/10 text-gold",
};

const BAR_COLORS = {
  error:   "bg-red-400",
  success: "bg-accent",
  info:    "bg-blue-400",
  warn:    "bg-gold",
};

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            pointer-events-auto
            flex items-start gap-3
            min-w-[260px] max-w-[380px]
            px-4 py-3 rounded-xl
            border backdrop-blur-md
            shadow-2xl
            font-mono text-xs
            animate-toast-in
            ${COLORS[t.type] ?? COLORS.info}
          `}
          style={{ animation: "toastIn 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <span className="text-sm leading-none mt-0.5 flex-shrink-0">
            {ICONS[t.type]}
          </span>
          <span className="flex-1 leading-relaxed break-words">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity text-sm leading-none mt-0.5"
          >
            ✕
          </button>

          {/* animated shrink bar */}
          <div
            className={`absolute bottom-0 left-0 h-0.5 rounded-b-xl ${BAR_COLORS[t.type]} animate-toast-bar`}
            style={{ animation: "toastBar 4.5s linear forwards" }}
          />
        </div>
      ))}

      {/* keyframes injected once */}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        @keyframes toastBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}