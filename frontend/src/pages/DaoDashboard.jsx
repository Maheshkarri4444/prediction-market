import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import BN from "bn.js";
import { useDaoData } from "../hooks/useDaoData";
import { useStake } from "../hooks/useStake";
import { useVote } from "../hooks/useVote";

// ── Tiny helpers ───────────────────────────────────────────────────────────────
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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
      <span
        className={`text-2xl font-mono font-bold ${
          accent === "gold"
            ? "text-gold"
            : accent === "green"
            ? "text-accent"
            : "text-white"
        }`}
      >
        {value}
      </span>
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

// ── Stake / Unstake Panel ─────────────────────────────────────────────────────
function StakePanel({ daoUser, onRefresh }) {
  const [tab, setTab] = useState("stake");
  const [amount, setAmount] = useState("");

  const { stake, unstake, staking, unstaking, error, setError } = useStake(
    () => {
      setAmount("");
      onRefresh();
    }
  );

  const freeAmountSol = daoUser
    ? parseFloat(lamportsToSol(daoUser.freeAmount))
    : 0;

  const handleSubmit = async () => {
    setError("");
    const val = parseFloat(amount);
    if (!val || val <= 0) return setError("Enter a valid amount.");
    if (tab === "unstake" && val > freeAmountSol)
      return setError(
        `Max unstakeable is ${freeAmountSol} SOL (free amount only).`
      );
    if (tab === "stake") await stake(val);
    else await unstake(val);
  };

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
            className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">
            SOL
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={staking || unstaking || !amount}
          className={`px-6 py-3 rounded-xl font-mono text-sm font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
            tab === "stake"
              ? "bg-accent text-black hover:bg-accent/90"
              : "bg-gold text-black hover:bg-gold/90"
          }`}
        >
          {staking || unstaking ? "…" : tab === "stake" ? "Stake" : "Unstake"}
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

// ── Vote Modal ────────────────────────────────────────────────────────────────
function VoteModal({ market, onClose, onRefresh }) {
  const [optionIdx, setOptionIdx] = useState(null);
  const [amount, setAmount] = useState("");
  const { vote, voting, error, setError } = useVote(() => {
    onRefresh();
    onClose();
  });

  const handleVote = async () => {
    if (optionIdx === null) return setError("Select an option.");
    const val = parseFloat(amount);
    if (!val || val <= 0) return setError("Enter stake amount.");
    await vote(market.publicKey, optionIdx, val);
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
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setOptionIdx(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border font-mono text-sm transition-all duration-150 ${
                optionIdx === i
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border bg-dim text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              <span className="text-white/30 mr-2">{i + 1}.</span>
              {opt.optionName ?? `Option ${i + 1}`}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Stake amount"
            className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all"
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
          disabled={voting || optionIdx === null || !amount}
          className="w-full py-3 rounded-xl bg-gold text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-gold/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {voting ? "Submitting…" : "Submit Vote"}
        </button>
      </div>
    </div>
  );
}

// ── Event Market Card ─────────────────────────────────────────────────────────
function EventMarketCard({ market, myVote, onVote }) {
  const acc = market.account;
  const resolved = acc.resolved === true;
  const options = acc.options ?? [];
  const totalPool = options.reduce((sum, o) => {
    try {
      return sum + o.poolAmount.toNumber();
    } catch {
      return sum;
    }
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
      {/* status pill */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-widest ${
            resolved
              ? "border-white/10 bg-white/5 text-white/30"
              : "border-gold/30 bg-gold/10 text-gold"
          }`}
        >
          {resolved ? "Resolved" : "Active"}
        </span>
        {!resolved && (
          <span className="text-[10px] font-mono text-white/30">
            Ends: {timeLeft(acc.eventEndTime ?? acc.bettingEndTime)}
          </span>
        )}
      </div>

      <h3 className="text-sm font-display tracking-wide text-white mb-4 leading-snug">
        {acc.question}
      </h3>

      {/* options */}
      <div className="space-y-2 mb-4">
        {options.map((opt, i) => {
          const pool = (() => {
            try {
              return opt.poolAmount.toNumber();
            } catch {
              return 0;
            }
          })();
          const pct = totalPool > 0 ? (pool / totalPool) * 100 : 0;
          const isWinner = resolved && winnerIndex === i;
          const isMyVoteOption =
            alreadyVoted &&
            (myVote.optionIndex === i || myVote.option === i);

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono ${
                      isWinner
                        ? "text-accent font-bold"
                        : "text-white/60"
                    }`}
                  >
                    {opt.optionName ?? `Option ${i + 1}`}
                  </span>
                  {isWinner && (
                    <span className="text-[9px] font-mono text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-full">
                      Winner
                    </span>
                  )}
                  {isMyVoteOption && (
                    <span className="text-[9px] font-mono text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-full">
                      Your vote
                    </span>
                  )}
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

      {/* footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/25">
          Pool: {(totalPool / 1_000_000_000).toFixed(4)} SOL
        </span>
        {!resolved && (
          alreadyVoted ? (
            <span className="text-[10px] font-mono text-gold/60">
              ✓ Voted
            </span>
          ) : (
            <button
              onClick={() => onVote(market)}
              className="text-xs font-mono font-semibold text-black bg-gold hover:bg-gold/90 px-4 py-1.5 rounded-lg transition-all duration-150"
            >
              Vote
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── NFT Profile Card ──────────────────────────────────────────────────────────
function NftProfileCard({ daoUser, nftMetadata }) {
  if (!daoUser) return null;

  return (
    <div className="p-6 rounded-2xl bg-panel border border-gold/20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-gold/60 via-gold to-gold/60" />
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/5 blur-2xl pointer-events-none" />

      <div className="flex gap-5 items-start relative z-10">
        {/* NFT image */}
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

        {/* details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-display text-xl tracking-widest text-white">
              {daoUser.username}
            </h3>
            {nftMetadata?.symbol && (
              <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                ${nftMetadata.symbol}
              </span>
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
              <span className="text-white/60">
                {shortKey(daoUser.pubkey)}
              </span>
            </span>
            <span className="text-white/30">
              NFT Mint{" "}
              <span className="text-white/60">
                {shortKey(daoUser.nftMint)}
              </span>
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

      {/* NFT metadata attributes */}
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

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={`rounded-xl bg-white/5 animate-pulse ${className ?? ""}`}
    />
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DaoDashboard() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { dao, daoUser, nftMetadata, eventMarkets, myVotes, loading, error, refresh } =
    useDaoData();

  const [voteTarget, setVoteTarget] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "resolved"

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
            onClick={refresh}
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
      {/* ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gold/4 blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
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
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-panel hover:border-gold/30 text-white/40 hover:text-white transition-all text-xs font-mono"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── DAO Global Stats ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
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

        {/* ── My DAO Profile ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <SectionTitle>My Profile</SectionTitle>
          {loading ? (
            <Skeleton className="h-40" />
          ) : daoUser ? (
            <>
              <NftProfileCard daoUser={daoUser} nftMetadata={nftMetadata} />

              {/* stake breakdown */}
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

        {/* ── Stake / Unstake ────────────────────────────────────────────────── */}
        {!loading && daoUser && (
          <div className="mb-10">
            <SectionTitle>Stake Management</SectionTitle>
            <StakePanel daoUser={daoUser} onRefresh={refresh} />
          </div>
        )}

        {/* ── Event Markets ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="font-display text-xl tracking-widest text-white uppercase">
              Event Markets
            </h2>

            {/* tab toggle */}
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
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
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
                  myVote={myVotes[m.publicKey.toBase58()] ?? null}
                  onVote={daoUser ? setVoteTarget : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Vote Modal ─────────────────────────────────────────────────────────── */}
      {voteTarget && (
        <VoteModal
          market={voteTarget}
          onClose={() => setVoteTarget(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}