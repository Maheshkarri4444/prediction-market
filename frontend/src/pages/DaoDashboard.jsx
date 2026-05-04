import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import BN from "bn.js";
import { useDaoData } from "../hooks/useDaoData";
import { useStake } from "../hooks/useStake";
import { useVote } from "../hooks/useVote";
import { useClaimStake } from "../hooks/useClaimStake";

// ─────────────────────────────────────────────────────────────────────────────
// Toast System
// ─────────────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message, type = "error") => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md
            transition-all duration-300 animate-toast-in
            ${
              t.type === "success"
                ? "bg-accent/10 border-accent/30 text-accent"
                : t.type === "info"
                ? "bg-white/8 border-white/15 text-white/80"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          style={{ animation: "toastIn 0.25s ease-out" }}
        >
          <span className="text-base leading-none mt-0.5 flex-shrink-0">
            {t.type === "success" ? "✓" : t.type === "info" ? "ℹ" : "⚠"}
          </span>
          <p className="text-xs font-mono leading-snug flex-1">{t.message}</p>
          <button
            onClick={() => onRemove(t.id)}
            className="text-xs opacity-40 hover:opacity-80 transition-opacity flex-shrink-0 ml-1"
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const lamportsToSol = (bn) => {
  try {
    return (bn.toNumber() / 1_000_000_000).toFixed(4);
  } catch {
    return "0.0000";
  }
};

const shortKey = (pk) => {
  const s = pk?.toBase58?.() ?? pk?.toString?.() ?? "";
  return s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "—";
};

const timeLeft = (tsBn) => {
  try {
    const ts = tsBn.toNumber() * 1000;
    const diff = ts - Date.now();
    if (diff <= 0) return "Ended";
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  } catch {
    return "—";
  }
};

function getEventOptionLabel(index, marketAccount) {
  const qt = marketAccount?.questionType ?? marketAccount?.question_type;
  if (qt && "optioned" in qt) {
    const eventOption = marketAccount.options?.[index];
    const name = eventOption?.optionName ?? eventOption?.option_name;
    if (name) return name;
    const qtOptions = qt.optioned.options ?? [];
    const qtName = qtOptions[index]?.optionName ?? qtOptions[index]?.option_name;
    if (qtName) return qtName;
    return `Option ${index + 1}`;
  }
  return index === 0 ? "No" : "Yes";
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated stat value — smoothly transitions when number changes
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedValue({ value, className }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value;
      setFlash(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setTimeout(() => setFlash(false), 300);
      }, 120);
      return () => clearTimeout(t);
    } else {
      setDisplay(value);
    }
  }, [value]);

  return (
    <span
      className={`${className} transition-all duration-300 inline-block`}
      style={{
        opacity: flash ? 0.4 : 1,
        transform: flash ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {display}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny UI atoms
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="p-5 rounded-2xl bg-panel border border-border flex flex-col gap-1 relative overflow-hidden">
      <div
        className={`absolute top-0 left-0 w-full h-0.5 ${
          accent === "gold"
            ? "bg-gold"
            : accent === "green"
            ? "bg-accent"
            : "bg-white/10"
        }`}
      />
      <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
        {label}
      </span>
      <AnimatedValue
        value={value}
        className={`text-2xl font-mono font-bold ${
          accent === "gold"
            ? "text-gold"
            : accent === "green"
            ? "text-accent"
            : "text-white"
        }`}
      />
      {sub && (
        <span className="text-[10px] font-mono text-white/30">{sub}</span>
      )}
    </div>
  );
}

function SectionTitle({ children, badge }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="font-display text-xl tracking-widest text-white uppercase">
        {children}
      </h2>
      {badge !== undefined && (
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/50">
          {badge}
        </span>
      )}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function Skeleton({ className }) {
  return (
    <div className={`rounded-xl bg-white/5 animate-pulse ${className ?? ""}`} />
  );
}

function Badge({ children, color = "default" }) {
  const cls = {
    default: "border-white/10 bg-white/5 text-white/40",
    green: "border-accent/30 bg-accent/10 text-accent",
    gold: "border-gold/30 bg-gold/10 text-gold",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
  }[color];
  return (
    <span
      className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StakePanel
// ─────────────────────────────────────────────────────────────────────────────
function StakePanel({ daoUser, onDaoUserRefresh, onToast }) {
  const [tab, setTab] = useState("stake");
  const [amount, setAmount] = useState("");
  // Single-tx guard: prevent concurrent calls
  const inFlightRef = useRef(false);

  const { stake, unstake, staking, unstaking, error, setError } = useStake(
    () => {
      setAmount("");
      onDaoUserRefresh();
      onToast("Stake updated successfully!", "success");
    }
  );

  const freeAmountSol = daoUser
    ? parseFloat(lamportsToSol(daoUser.freeAmount))
    : 0;

  const handleSubmit = async () => {
    if (inFlightRef.current) return;          // ← guard
    setError("");
    const val = parseFloat(amount);
    if (!val || val <= 0) return setError("Enter a valid amount.");
    if (tab === "unstake" && val > freeAmountSol)
      return setError(
        `Max unstakeable is ${freeAmountSol} SOL (free amount only).`
      );

    inFlightRef.current = true;
    try {
      if (tab === "stake") await stake(val);
      else await unstake(val);
    } catch (e) {
      const msg = e?.message ?? "Transaction failed";
      onToast(msg, "error");
    } finally {
      inFlightRef.current = false;
    }
  };

  // Surface hook errors as toasts too
  useEffect(() => {
    if (error) onToast(error, "error");
  }, [error]);

  const busy = staking || unstaking;

  return (
    <div className="p-6 rounded-2xl bg-panel border border-border">
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-dim border border-border w-fit">
        {["stake", "unstake"].map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError("");
              setAmount("");
            }}
            className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold uppercase tracking-widest transition-all duration-200 ${
              tab === t
                ? t === "stake"
                  ? "bg-accent text-black"
                  : "bg-gold text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "unstake" && daoUser && (
        <p className="text-xs font-mono text-white/40 mb-3">
          Available to unstake:{" "}
          <span className="text-gold font-semibold">{freeAmountSol} SOL</span>
          {" "}(locked:{" "}
          <span className="text-white/60">
            {lamportsToSol(daoUser.lockedAmount)} SOL
          </span>
          )
        </p>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={busy}
            className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">
            SOL
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={busy || !amount || inFlightRef.current}
          className={`px-6 py-3 rounded-xl font-mono text-sm font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
            tab === "stake"
              ? "bg-accent text-black hover:bg-accent/90"
              : "bg-gold text-black hover:bg-gold/90"
          }`}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Spinner /> {tab === "stake" ? "Staking…" : "Unstaking…"}
            </span>
          ) : tab === "stake" ? (
            "Stake"
          ) : (
            "Unstake"
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

// Tiny spinner
function Spinner() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VoteModal
// ─────────────────────────────────────────────────────────────────────────────
function VoteModal({ market, onClose, onMarketRefresh, onToast }) {
  const [optionIdx, setOptionIdx] = useState(null);
  const [amount, setAmount] = useState("");
  const inFlightRef = useRef(false);

  const { vote, voting, error, setError } = useVote(() => {
    onMarketRefresh(market.publicKey);
    onToast("Vote submitted successfully!", "success");
    onClose();
  });

  useEffect(() => {
    if (error) onToast(error, "error");
  }, [error]);

  const handleVote = async () => {
    if (inFlightRef.current) return;
    if (optionIdx === null) return setError("Select an option.");
    const val = parseFloat(amount);
    if (!val || val <= 0) return setError("Enter stake amount.");

    inFlightRef.current = true;
    try {
      await vote(market.publicKey, optionIdx, val);
    } catch (e) {
      onToast(e?.message ?? "Vote failed", "error");
    } finally {
      inFlightRef.current = false;
    }
  };

  const options = market.account.options ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-panel border border-border shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[10px] font-mono text-gold uppercase tracking-widest">
              Cast Vote
            </span>
            <h3 className="text-lg font-display tracking-wider text-white mt-1 leading-snug">
              {market.account.question}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white text-xl ml-4"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {options.map((opt, i) => {
            const label = getEventOptionLabel(i, market.account);
            return (
              <button
                key={i}
                onClick={() => setOptionIdx(i)}
                disabled={voting}
                className={`w-full text-left px-4 py-3 rounded-xl border font-mono text-sm transition-all duration-150 disabled:opacity-50 ${
                  optionIdx === i
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border bg-dim text-white/60 hover:border-white/30 hover:text-white"
                }`}
              >
                <span className="text-white/30 mr-2">{i + 1}.</span>
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative mb-4">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Stake amount"
            disabled={voting}
            className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all disabled:opacity-50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">
            SOL
          </span>
        </div>

        {error && (
          <p className="mb-3 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            ⚠ {error}
          </p>
        )}

        <button
          onClick={handleVote}
          disabled={voting || optionIdx === null || !amount || inFlightRef.current}
          className="w-full py-3 rounded-xl bg-gold text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-gold/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {voting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Submitting…
            </span>
          ) : (
            "Submit Vote"
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventMarketCard
// ─────────────────────────────────────────────────────────────────────────────
function EventMarketCard({ market, myVote, onVote }) {
  const acc = market.account;
  const resolved = acc.resolved === true;
  const options = acc.options ?? [];

  const totalPool = options.reduce((sum, o) => {
    try { return sum + o.poolAmount.toNumber(); } catch { return sum; }
  }, 0);

  const winnerIndex =
    resolved && acc.finalOutcome !== null && acc.finalOutcome !== undefined
      ? typeof acc.finalOutcome === "object"
        ? Object.values(acc.finalOutcome)[0]
        : acc.finalOutcome
      : null;

  const alreadyVoted = !!myVote;

  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
        resolved
          ? "bg-panel/60 border-border/50"
          : "bg-panel border-border hover:border-gold/30"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge color={resolved ? "default" : "gold"}>
          {resolved ? "Resolved" : "Active"}
        </Badge>
        {!resolved && (
          <span className="text-[10px] font-mono text-white/30">
            Ends: {timeLeft(acc.eventEndTime ?? acc.bettingEndTime)}
          </span>
        )}
      </div>

      <h3 className="text-sm font-display tracking-wide text-white mb-4 leading-snug">
        {acc.question}
      </h3>

      <div className="space-y-2 mb-4">
        {options.map((opt, i) => {
          const pool = (() => {
            try { return opt.poolAmount.toNumber(); } catch { return 0; }
          })();
          const pct = totalPool > 0 ? (pool / totalPool) * 100 : 0;
          const isWinner = resolved && winnerIndex === i;
          const isMyVoteOption = alreadyVoted && myVote.optionId === i;
          const label = getEventOptionLabel(i, acc);

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono ${
                      isWinner ? "text-accent font-bold" : "text-white/60"
                    }`}
                  >
                    {label}
                  </span>
                  {isWinner && <Badge color="green">Winner</Badge>}
                  {isMyVoteOption && <Badge color="gold">Your vote</Badge>}
                </div>
                <span className="text-[10px] font-mono text-white/30">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isWinner ? "bg-accent" : "bg-white/20"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/25">
          Pool: {(totalPool / 1_000_000_000).toFixed(4)} SOL
        </span>
        {!resolved &&
          (alreadyVoted ? (
            <span className="text-[10px] font-mono text-gold/60">✓ Voted</span>
          ) : (
            <button
              onClick={() => onVote(market)}
              className="text-xs font-mono font-semibold text-black bg-gold hover:bg-gold/90 px-4 py-1.5 rounded-lg transition-all duration-150"
            >
              Vote
            </button>
          ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NftProfileCard
// ─────────────────────────────────────────────────────────────────────────────
function NftProfileCard({ daoUser, nftMetadata }) {
  if (!daoUser) return null;
  return (
    <div className="p-6 rounded-2xl bg-panel border border-gold/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-gold/60 via-gold to-gold/60" />
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/5 blur-2xl pointer-events-none" />

      <div className="flex gap-5 items-start relative z-10">
        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-gold/30 flex-shrink-0 bg-dim">
          {nftMetadata?.image ? (
            <img
              src={nftMetadata.image}
              alt={nftMetadata.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gold/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-display text-xl tracking-widest text-white">
              {daoUser.username}
            </h3>
            {nftMetadata?.symbol && (
              <Badge color="gold">${nftMetadata.symbol}</Badge>
            )}
          </div>
          {nftMetadata?.description && (
            <p className="text-xs text-white/40 font-mono leading-relaxed mb-3 line-clamp-2">
              {nftMetadata.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] font-mono">
            <span className="text-white/30">
              Wallet{" "}
              <span className="text-white/60">{shortKey(daoUser.pubkey)}</span>
            </span>
            <span className="text-white/30">
              NFT Mint{" "}
              <span className="text-white/60">{shortKey(daoUser.nftMint)}</span>
            </span>
            <span className="text-white/30">
              Reputation{" "}
              <span className="text-gold font-bold">
                {daoUser.reputation?.toString?.() ?? "—"}
              </span>
            </span>
            <span className="text-white/30">
              Total Votes{" "}
              <span className="text-white/60">
                {daoUser.totalVotes?.toString?.() ?? "0"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {nftMetadata?.attributes?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-2">
          {nftMetadata.attributes.map((attr, i) => (
            <div
              key={i}
              className="px-3 py-1.5 rounded-lg bg-dim border border-border text-[10px] font-mono"
            >
              <span className="text-white/30">{attr.trait_type}: </span>
              <span className="text-white/70">{attr.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClaimableRow
// ─────────────────────────────────────────────────────────────────────────────
function ClaimableRow({ voteEntry, eventMarkets, onClaimSuccess, onToast }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  // Single-tx guard
  const inFlightRef = useRef(false);

  const marketObj = useMemo(() => {
    if (!eventMarkets || !voteEntry.market) return null;
    const marketKeyStr =
      voteEntry.market?.toBase58?.() ?? String(voteEntry.market);
    return (
      eventMarkets.find(
        (m) => m.publicKey.toBase58() === marketKeyStr
      ) ?? null
    );
  }, [eventMarkets, voteEntry.market]);

  const optionLabel = useMemo(() => {
    if (!marketObj) return `Option ${(voteEntry.optionId ?? 0) + 1}`;
    return getEventOptionLabel(voteEntry.optionId ?? 0, marketObj.account);
  }, [marketObj, voteEntry.optionId]);

  const { claimStake } = useClaimStake((marketKey) => {
    setClaiming(false);
    onClaimSuccess(marketKey);
    onToast("Stake claimed successfully!", "success");
  });

  const handleClaim = async () => {
    if (inFlightRef.current) return;           // ← guard
    inFlightRef.current = true;
    setClaiming(true);
    setError("");
    try {
      await claimStake(voteEntry.publicKey, voteEntry.market);
    } catch (e) {
      setClaiming(false);
      const msg = e?.message ?? "Claim failed";
      setError(msg);
      onToast(msg, "error");
    } finally {
      inFlightRef.current = false;
    }
  };

  const stakeSOL = lamportsToSol(voteEntry.stakeVoted ?? new BN(0));
  const claimed = voteEntry.stakeClaimed === true;

  const isResolved = marketObj?.account?.resolved === true;
  const winnerIndex = isResolved
    ? (() => {
        const fo = marketObj?.account?.finalOutcome;
        if (fo == null) return null;
        return typeof fo === "object" ? Object.values(fo)[0] : fo;
      })()
    : null;
  const isWinner = winnerIndex !== null && winnerIndex === voteEntry.optionId;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all duration-200 ${
        claimed
          ? "bg-panel/40 border-border/30 opacity-60"
          : isWinner && isResolved
          ? "bg-accent/5 border-accent/20"
          : "bg-panel border-border hover:border-gold/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge color={isResolved ? (isWinner ? "green" : "red") : "gold"}>
              {isResolved ? (isWinner ? "Winner ✓" : "Lost") : "Pending"}
            </Badge>
          </div>
          <p className="text-xs font-mono text-white/70 leading-snug mb-1.5 line-clamp-2">
            {voteEntry.question ?? shortKey(voteEntry.market)}
          </p>
          <div className="flex items-center gap-3 text-[10px] font-mono text-white/30 flex-wrap">
            <span>
              Voted:{" "}
              <span
                className={
                  isWinner && isResolved ? "text-accent font-semibold" : "text-white/60"
                }
              >
                {optionLabel}
              </span>
            </span>
            <span>·</span>
            <span>
              Staked:{" "}
              <span className="text-gold font-semibold">{stakeSOL} SOL</span>
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {claimed ? (
            <span className="text-[10px] font-mono text-white/30 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              ✓ Claimed
            </span>
          ) : !isResolved ? (
            <span className="text-[10px] font-mono text-white/25 whitespace-nowrap">
              Awaiting resolution
            </span>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming || inFlightRef.current}
              className={`text-xs font-mono font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isWinner
                  ? "bg-accent text-black hover:bg-accent/80"
                  : "bg-white/10 text-white/50 hover:bg-white/20 border border-border"
              }`}
            >
              {claiming ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  {isWinner ? "Claiming…" : "Burning…"}
                </span>
              ) : isWinner ? (
                "Claim Reward"
              ) : (
                "Burn Tokens"
              )}
            </button>
          )}
        </div>
      </div>

      {isResolved && !claimed && (
        <div
          className={`mt-3 pt-3 border-t ${
            isWinner ? "border-accent/10" : "border-red-500/10"
          }`}
        >
          <p
            className={`text-[10px] font-mono ${
              isWinner ? "text-accent/60" : "text-red-400/40"
            }`}
          >
            {isWinner
              ? "🎉 You picked the winning option. Claim your share of the pool."
              : "Burn your tokens to clear the position. No reward for this one."}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClaimableSection
// ─────────────────────────────────────────────────────────────────────────────
function ClaimableSection({ myVotesArray, eventMarkets, onClaimSuccess, loading, onToast }) {
  const unclaimedCount = myVotesArray.filter((v) => !v.stakeClaimed).length;

  return (
    <div className="mb-10">
      <SectionTitle
        badge={
          unclaimedCount > 0
            ? `${unclaimedCount} pending`
            : myVotesArray.length
        }
      >
        Claimable Stakes
      </SectionTitle>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : myVotesArray.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-border bg-panel">
          <p className="text-white/20 font-mono text-sm">
            No votes found. Cast a vote on a market to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {myVotesArray.map((voteEntry) => (
            <ClaimableRow
              key={
                voteEntry.publicKey?.toBase58?.() ??
                `${voteEntry.market?.toBase58?.()}-${voteEntry.optionId}`
              }
              voteEntry={voteEntry}
              eventMarkets={eventMarkets}
              onClaimSuccess={onClaimSuccess}
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DaoDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function DaoDashboard() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { toasts, addToast, removeToast } = useToast();

  const {
    dao,
    daoUser,
    nftMetadata,
    eventMarkets,
    myVotes,
    myVotesArray,
    loading,
    error,
    refreshAll,
    refreshDaoUser,
    refreshMarket,
    refreshVote,
  } = useDaoData();

  const [voteTarget, setVoteTarget] = useState(null);
  const [activeTab, setActiveTab] = useState("active");

  const handleMarketRefresh = useCallback(
    (marketPk) => { refreshMarket?.(marketPk); },
    [refreshMarket]
  );

  const handleDaoUserRefresh = useCallback(() => {
    refreshDaoUser?.();
  }, [refreshDaoUser]);

  const handleClaimSuccess = useCallback(
    (marketKey) => {
      refreshVote?.(marketKey);
      refreshDaoUser?.();
    },
    [refreshVote, refreshDaoUser]
  );

  const activeMarkets = useMemo(
    () => eventMarkets.filter((m) => !m.account.resolved),
    [eventMarkets]
  );
  const resolvedMarkets = useMemo(
    () => eventMarkets.filter((m) => m.account.resolved),
    [eventMarkets]
  );
  const displayMarkets =
    activeTab === "active" ? activeMarkets : resolvedMarkets;

  if (!publicKey) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 font-mono text-sm mb-4">
            Connect your wallet to view the DAO dashboard.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-xs font-mono text-gold hover:text-white transition-colors"
          >
            ← Go home
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-red-400 font-mono text-sm mb-2">
            Failed to load DAO data
          </p>
          <p className="text-white/30 font-mono text-xs mb-5">{error}</p>
          <button
            onClick={refreshAll}
            className="text-xs font-mono text-accent hover:text-white transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen grid-bg">
      {/* Toast container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gold/4 blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <span className="text-[10px] font-mono text-gold uppercase tracking-[0.2em] block mb-1">
              Governance
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white">
              DAO <span className="text-gold">DASHBOARD</span>
            </h1>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-panel hover:border-gold/30 text-white/40 hover:text-white transition-all text-xs font-mono"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh All
          </button>
        </div>

        {/* ── Global Stats ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : dao ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <StatCard
              label="Total Members"
              value={dao.totalMembers?.toString?.() ?? "—"}
              accent="gold"
            />
            <StatCard
              label="Total Staked"
              value={`${lamportsToSol(dao.daoTotalStake ?? new BN(0))} SOL`}
              accent="green"
            />
            <StatCard
              label="Active Markets"
              value={activeMarkets.length}
              sub={`${resolvedMarkets.length} resolved`}
            />
            <StatCard
              label="Quorum (10%)"
              value={`${lamportsToSol(
                (dao.daoTotalStake ?? new BN(0)).divn(10)
              )} SOL`}
              sub="Required to resolve"
            />
          </div>
        ) : null}

        {/* ── My Profile ── */}
        <div className="mb-10">
          <SectionTitle>My Profile</SectionTitle>
          {loading ? (
            <Skeleton className="h-40" />
          ) : daoUser ? (
            <>
              <NftProfileCard daoUser={daoUser} nftMetadata={nftMetadata} />
              <div className="grid grid-cols-3 gap-4 mt-4">
                <StatCard
                  label="Total Stake"
                  value={`${lamportsToSol(daoUser.totalStake ?? new BN(0))} SOL`}
                  accent="gold"
                />
                <StatCard
                  label="Free (Unstakeable)"
                  value={`${lamportsToSol(daoUser.freeAmount ?? new BN(0))} SOL`}
                  accent="green"
                  sub="Can be unstaked"
                />
                <StatCard
                  label="Locked"
                  value={`${lamportsToSol(daoUser.lockedAmount ?? new BN(0))} SOL`}
                  sub="Voting in progress"
                />
              </div>
            </>
          ) : (
            <div className="p-6 rounded-2xl bg-panel border border-border text-center">
              <p className="text-white/40 font-mono text-sm mb-3">
                You are not registered as a DAO member.
              </p>
              <button
                onClick={() => navigate("/register/dao")}
                className="text-xs font-mono text-gold hover:text-white transition-colors"
              >
                Register as DAO member →
              </button>
            </div>
          )}
        </div>

        {/* ── Stake Management ── */}
        {!loading && daoUser && (
          <div className="mb-10">
            <SectionTitle>Stake Management</SectionTitle>
            <StakePanel
              daoUser={daoUser}
              onDaoUserRefresh={handleDaoUserRefresh}
              onToast={addToast}
            />
          </div>
        )}

        {/* ── Claimable Stakes ── */}
        {!loading && daoUser && (
          <ClaimableSection
            myVotesArray={myVotesArray ?? []}
            eventMarkets={eventMarkets}
            onClaimSuccess={handleClaimSuccess}
            loading={loading}
            onToast={addToast}
          />
        )}

        {/* ── Event Markets ── */}
        <div>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="font-display text-xl tracking-widest text-white uppercase">
              Event Markets
            </h2>
            <div className="flex gap-1 p-1 rounded-xl bg-dim border border-border">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all duration-200 ${
                  activeTab === "active"
                    ? "bg-gold text-black"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Active{" "}
                <span className="ml-1 opacity-70">{activeMarkets.length}</span>
              </button>
              <button
                onClick={() => setActiveTab("resolved")}
                className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all duration-200 ${
                  activeTab === "resolved"
                    ? "bg-white/20 text-white"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Resolved{" "}
                <span className="ml-1 opacity-70">{resolvedMarkets.length}</span>
              </button>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : displayMarkets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/20 font-mono text-sm">
                No {activeTab} event markets found.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayMarkets.map((m) => (
                <EventMarketCard
                  key={m.publicKey.toBase58()}
                  market={m}
                  myVote={myVotes?.[m.publicKey.toBase58()] ?? null}
                  onVote={daoUser ? setVoteTarget : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Vote Modal ── */}
      {voteTarget && (
        <VoteModal
          market={voteTarget}
          onClose={() => setVoteTarget(null)}
          onMarketRefresh={handleMarketRefresh}
          onToast={addToast}
        />
      )}
    </div>
  );
}