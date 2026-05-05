import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { useCheckUser } from "../hooks/useCheckUser";
import { useMarkets } from "../hooks/useMarkets";
import { useMyOrders } from "../hooks/useOrders";
import {
  useCreatePriceMarket,
  useCreateEventMarket,
  useAddOptionDetails,
  useAddEventOption,
} from "../hooks/useCreateMarket";
import { useResolvePriceMarket, useResolveEventMarket } from "../hooks/useResolveMarket";
import { useCreateOrder, useCreateEventOrder, computeOptionPrice } from "../hooks/useCreateOrder";
import { useClaimReward, useClaimEventReward, useClaimablePositions } from "../hooks/useClaimReward";
import { PYTH_FEED_SYMBOLS } from "../constants";
import { useProgram } from "../hooks/useProgram";
import { ToastProvider, useToast } from "../hooks/useToast";

// ── Helpers ────────────────────────────────────────────────────────────────────
const lamToSol = (bn) => {
  try { return (bn.toNumber() / 1e9).toFixed(4); } catch { return "0.0000"; }
};
const shortKey = (pk) => {
  const s = pk?.toBase58?.() ?? String(pk ?? "");
  return s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "—";
};
const tsToDate = (bn) => {
  try { return new Date(bn.toNumber() * 1000).toLocaleString(); } catch { return "—"; }
};
const timeLeft = (bn) => {
  try {
    const diff = bn.toNumber() * 1000 - Date.now();
    if (diff <= 0) return "Ended";
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  } catch { return "—"; }
};

const getFeedInfo = (pkOrStr) => {
  const k = pkOrStr?.toBase58?.() ?? String(pkOrStr ?? "");
  return PYTH_FEED_SYMBOLS[k] ?? { symbol: "?", name: k.slice(0, 8) };
};

// ── Option label logic ─────────────────────────────────────────────────────────
function getOptionLabel(index, marketAccount, isEvent) {
  const qt = marketAccount.questionType ?? marketAccount.question_type;

  if (!isEvent) {
    if (qt && "rangeOfPrice" in qt) {
      const priceOptions = qt.rangeOfPrice.options ?? [];
      const po = priceOptions[index];
      if (po) return `$${po.lowerBound ?? po.lower_bound} – $${po.upperBound ?? po.upper_bound}`;
    }
    return index === 0 ? "No" : "Yes";
  } else {
    const eqt = marketAccount.questionType ?? marketAccount.question_type;
    if (eqt && "optioned" in eqt) {
      const eventOption = marketAccount.options?.[index];
      const name = eventOption?.optionName ?? eventOption?.option_name;
      if (name) return name;
      const qtOptions = eqt.optioned.options ?? [];
      return qtOptions[index]?.optionName ?? qtOptions[index]?.option_name ?? `Option ${index + 1}`;
    }
    return index === 0 ? "No" : "Yes";
  }
}

const qTypeLabel = (qt) => {
  if (!qt) return "Unknown";
  if ("greaterThanAtTime" in qt) return `> ${qt.greaterThanAtTime.targetPrice} at time`;
  if ("lessThanAtTime" in qt) return `< ${qt.lessThanAtTime.targetPrice} at time`;
  if ("rangeAtTime" in qt) return `Range at time`;
  if ("rangeOfPrice" in qt) return `Price ranges`;
  if ("percentageUp" in qt) return `↑ ${qt.percentageUp.percentage}% up`;
  if ("percentageDown" in qt) return `↓ ${qt.percentageDown.percentage}% down`;
  return "Custom";
};

const getPriceFeedFromQt = (qt) => {
  if (!qt) return null;
  for (const v of Object.values(qt)) {
    if (v?.priceFeed) return new PublicKey(v.priceFeed);
  }
  return null;
};

const getTargetTime = (qt) => {
  if (!qt) return null;
  for (const v of Object.values(qt)) {
    if (v?.time) return v.time;
  }
  return null;
};

const canResolvePriceMarket = (acc) => {
  if (acc.resolved) return false;
  try {
    const now = Date.now();
    const marketEnded = now > acc.marketEndTime.toNumber() * 1000;
    if (!marketEnded) return false;
    const targetTime = getTargetTime(acc.questionType);
    if (!targetTime) return false;
    return now > targetTime.toNumber() * 1000;
  } catch { return false; }
};

const getEventMarketResolveStatus = (acc, daoTotalStake) => {
  if (acc.resolved) return "resolved";
  try {
    const now = Date.now();
    const eventEnded = now > acc.eventEndTime.toNumber() * 1000;
    if (!eventEnded) return "time_pending";
    const totalVoted = (acc.options ?? []).reduce(
      (s, o) => s + (o.stakeVoted?.toNumber?.() ?? 0), 0
    );
    if (!daoTotalStake) return "quorum_pending";
    const quorum = daoTotalStake.toNumber() / 10;
    if (totalVoted < quorum) return "quorum_pending";
    return "can_resolve";
  } catch { return "time_pending"; }
};

// ── Hook: fetch DAO total stake ────────────────────────────────────────────────
function useDaoTotalStake() {
  const program = useProgram();
  const [daoTotalStake, setDaoTotalStake] = useState(null);

  useEffect(() => {
    if (!program) return;
    let cancelled = false;
    (async () => {
      try {
        const [daoPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("prediction_market_dao")],
          program.programId
        );
        const daoAcc = await program.account.dao.fetch(daoPda);
        if (!cancelled && daoAcc?.daoTotalStake) setDaoTotalStake(daoAcc.daoTotalStake);
      } catch { /* DAO may not be initialized */ }
    })();
    return () => { cancelled = true; };
  }, [program]);

  return daoTotalStake;
}

// Real-time betting closed check
function useBettingClosed(marketEndTimeBN) {
  const [closed, setClosed] = useState(() => {
    try { return Date.now() > marketEndTimeBN.toNumber() * 1000; } catch { return false; }
  });
  useEffect(() => {
    try {
      const endMs = marketEndTimeBN.toNumber() * 1000;
      if (Date.now() > endMs) { setClosed(true); return; }
      const remaining = endMs - Date.now();
      const tid = setTimeout(() => setClosed(true), remaining + 500);
      return () => clearTimeout(tid);
    } catch { /* noop */ }
  }, [marketEndTimeBN]);
  return closed;
}

// ── Tiny UI atoms ──────────────────────────────────────────────────────────────
function Badge({ children, color = "default" }) {
  const cls = {
    default: "border-white/10 bg-white/5 text-white/40",
    green: "border-accent/30 bg-accent/10 text-accent",
    gold: "border-gold/30 bg-gold/10 text-gold",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    blue: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  }[color];
  return (
    <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all duration-150 ${
        active ? "bg-accent text-black" : "text-white/40 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", hint, required }) {
  return (
    <div>
      <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-dim border border-border rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/20 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/10 transition-all"
      />
      {hint && <p className="mt-1 text-[10px] font-mono text-white/25">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options, required, searchable = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!searchable) {
    return (
      <div>
        <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
          {label}{required && <span className="text-accent ml-1">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-dim border border-border rounded-xl px-4 py-2.5 text-white text-sm font-mono outline-none focus:border-accent/50 transition-all"
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  const selectedLabel = value ? (options.find((o) => o.value === value)?.label ?? value) : null;
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-dim border border-border rounded-xl px-4 py-2.5 text-left text-sm font-mono outline-none focus:border-accent/50 transition-all flex items-center justify-between gap-2"
      >
        <span className={selectedLabel ? "text-white" : "text-white/25"}>
          {selectedLabel ?? "— Select a feed —"}
        </span>
        <span className={`text-white/30 text-xs transition-transform duration-150 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-panel shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border/50">
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dim border border-border rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/20 outline-none focus:border-accent/50 transition-all"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs font-mono text-white/25">No feeds match "{search}"</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setSearch(""); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-colors hover:bg-white/5 ${
                    o.value === value ? "text-accent bg-accent/5" : "text-white/70"
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
          <div className="px-4 py-1.5 border-t border-border/50">
            <span className="text-[9px] font-mono text-white/20">{filtered.length} devnet feeds</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrMsg({ msg }) {
  if (!msg) return null;
  return (
    <p className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
      ⚠ {msg}
    </p>
  );
}

function Skeleton({ className }) {
  return <div className={`rounded-xl bg-white/5 animate-pulse ${className}`} />;
}

// ── OptionBar ─────────────────────────────────────────────────────────────────
function OptionBar({ option, allOptions, index, isWinner, label, myOptionIndices, onBuy }) {
  const price = computeOptionPrice(option, allOptions);
  const pct = (price * 100).toFixed(1);
  const isMine = myOptionIndices?.includes(index);

  return (
    <div className={`p-3 rounded-xl border transition-all ${
      isMine ? "border-accent/30 bg-accent/5" : "border-border/50 bg-dim/50"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-semibold ${isWinner ? "text-accent" : "text-white/70"}`}>
            {label}
          </span>
          {isWinner && <Badge color="green">Winner</Badge>}
          {isMine && <Badge color="blue">Your bet</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-mono font-bold ${isWinner ? "text-accent" : "text-white"}`}>
            {pct}%
          </span>
          {onBuy && (
            <button
              onClick={() => onBuy(index)}
              className="text-[10px] font-mono text-black bg-accent hover:bg-accent/80 px-3 py-1 rounded-lg transition-all font-semibold"
            >
              Buy
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isWinner ? "bg-accent" : "bg-white/25"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-white/20">Pool: {lamToSol(option.poolAmount)} SOL</span>
        <span className="text-[9px] font-mono text-white/20">Virtual: {lamToSol(option.virtualPoolAmount)} SOL</span>
      </div>
    </div>
  );
}

// ── OrderRow ──────────────────────────────────────────────────────────────────
function OrderRow({ order, isMine, market, isEvent }) {
  const acc = market?.account;
  const optIdx = order.account.option;
  const label = acc ? getOptionLabel(optIdx, acc, isEvent) : `Option ${optIdx + 1}`;

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs font-mono transition-all ${
      isMine ? "bg-accent/8 border border-accent/20" : "bg-dim/40 border border-border/30"
    }`}>
      <div className="flex items-center gap-3">
        {isMine && <span className="text-accent text-[9px]">YOU</span>}
        <span className="text-white/40">{shortKey(order.account.buyer)}</span>
        <span className={isMine ? "text-accent" : "text-white/60"}>{label}</span>
      </div>
      <div className="flex items-center gap-4 text-white/30">
        <span>Qty: {order.account.quantity.toString()}</span>
        <span>{tsToDate(order.account.timeStamp)}</span>
      </div>
    </div>
  );
}

// ── BuyModal ─────────────────────────────────────────────────────────────────
// FIX (toast): hooks re-throw, so catch here shows real error in toast.
function BuyModal({ market, optionIndex, isEvent, onClose, onRefreshSingle }) {
  const { toast } = useToast();
  const [qty, setQty] = useState("1000000");

  const handleRefresh = useCallback(() => {
    onRefreshSingle(market.publicKey);
  }, [market.publicKey, onRefreshSingle]);

  const { createOrder, loading: lo } = useCreateOrder(handleRefresh);
  const { createEventOrder, loading: le } = useCreateEventOrder(handleRefresh);

  const options = market.account.options ?? [];
  const opt = options[optionIndex];
  const price = opt ? computeOptionPrice(opt, options) : 0;
  const estSol = opt ? (price * parseInt(qty || "0") / 1e6) : 0;
  const label = getOptionLabel(optionIndex, market.account, isEvent);

  const handle = async () => {
    try {
      if (isEvent) {
        await createEventOrder(market, optionIndex, parseInt(qty));
      } else {
        await createOrder(market, optionIndex, parseInt(qty));
      }
      // Only reaches here if no error thrown
      toast.success("Order placed successfully!");
      onClose();
    } catch (e) {
      // Anchor errors often have the human message after "Error Message:"
      const raw = e?.message ?? "Failed to place order";
      const match = raw.match(/Error Message: (.+?)(?:\.|$)/);
      toast.error(match ? match[1] : raw);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm p-7 rounded-2xl bg-panel border border-border shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-mono text-accent uppercase tracking-widest mb-0.5">Buy Shares</p>
            <h3 className="text-base font-display tracking-wider text-white">{label}</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-dim border border-border">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-white/40">Price per share</span>
            <span className="text-white font-bold">{(price * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-xs font-mono mt-1">
            <span className="text-white/40">Est. cost</span>
            <span className="text-accent">{estSol.toFixed(6)} SOL</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
            Quantity (token units)
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full bg-dim border border-border rounded-xl px-4 py-2.5 text-white text-sm font-mono outline-none focus:border-accent/50 transition-all"
          />
          <p className="text-[10px] font-mono text-white/20 mt-1">1,000,000 = 1 token (6 decimals)</p>
        </div>

        <button
          onClick={handle}
          disabled={lo || le || !qty}
          className="w-full mt-3 py-3 rounded-xl bg-accent text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-40"
        >
          {lo || le ? "Processing…" : "Confirm Buy"}
        </button>
      </div>
    </div>
  );
}

// ── MarketCard ────────────────────────────────────────────────────────────────
// FIX (add option): addOption/addEventOption take a PublicKey directly,
// matching the original hook signatures exactly.
function MarketCard({
  market,
  isEvent,
  myOrders,
  daoTotalStake,
  onRefreshSingle,
  isMyMarket,
}) {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [buyOption, setBuyOption] = useState(null);
  const [optimisticResolved, setOptimisticResolved] = useState(false);

  const acc = market.account;
  const isResolved = acc.resolved || optimisticResolved;
  const options = acc.options ?? [];
  const bettingClosed = useBettingClosed(acc.marketEndTime);

  const isCreator =
    publicKey != null &&
    acc.authority != null &&
    acc.authority.toBase58() === publicKey.toBase58();

  const myOptionIndices = myOrders
    ?.filter((o) => o.account.market.toBase58() === market.publicKey.toBase58())
    ?.map((o) => o.account.option) ?? [];
  const hasMine = myOptionIndices.length > 0;

  const canResolve = !isResolved && (isEvent ? false : canResolvePriceMarket(acc));
  const eventResolveStatus = isEvent ? getEventMarketResolveStatus(acc, daoTotalStake) : null;

  const needsMoreOptions =
    isCreator && options.length < (acc.numOptions ?? 0) && !acc.started;

  const feedInfo = !isEvent ? getFeedInfo(getPriceFeedFromQt(acc.questionType)) : null;
  const winnerIdx =
    isResolved && acc.finalOutcome != null
      ? typeof acc.finalOutcome === "object"
        ? Object.values(acc.finalOutcome)[0]
        : acc.finalOutcome
      : null;

  const handleResolved = useCallback(() => {
    setOptimisticResolved(true);
    onRefreshSingle(market.publicKey);
  }, [market.publicKey, onRefreshSingle]);

  const { resolveMarket, loading: rpl, error: rpe } = useResolvePriceMarket(handleResolved);
  const { resolveEventMarket, loading: rel, error: ree } = useResolveEventMarket(handleResolved);

  useEffect(() => { if (rpe) toast.error(rpe); }, [rpe]);
  useEffect(() => { if (ree) toast.error(ree); }, [ree]);

  // FIX (add option): pass market.publicKey (a PublicKey) — matches hook signature
  const { addOption, loading: aol, error: aoe } = useAddOptionDetails(() => {
    onRefreshSingle(market.publicKey);
  });
  const { addEventOption, loading: aeol, error: aeoe } = useAddEventOption(() => {
    onRefreshSingle(market.publicKey);
  });

  useEffect(() => { if (aoe) toast.error(aoe); }, [aoe]);
  useEffect(() => { if (aeoe) toast.error(aeoe); }, [aeoe]);

  const handleResolve = async () => {
    try {
      await resolveMarket(market, getPriceFeedFromQt(acc.questionType));
      toast.success("Market resolved!");
    } catch (e) {
      toast.error(e?.message ?? "Failed to resolve market");
    }
  };

  const handleResolveEvent = async () => {
    try {
      await resolveEventMarket(market);
      toast.success("Event market resolved!");
    } catch (e) {
      toast.error(e?.message ?? "Failed to resolve event market");
    }
  };

  const handleAddOption = async () => {
    try {
      if (isEvent) {
        await addEventOption(market.publicKey);
      } else {
        await addOption(market.publicKey);
      }
      toast.success(`Option ${options.length + 1} added`);
    } catch (e) {
      toast.error(e?.message ?? "Failed to add option");
    }
  };

  return (
    <>
      <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isResolved
          ? "border-border/40 bg-panel/60"
          : hasMine
          ? "border-accent/30 bg-panel"
          : "border-border bg-panel hover:border-accent/20"
      }`}>
        <div className="h-0.5 w-full" style={{
          background: isResolved
            ? "rgba(255,255,255,0.05)"
            : isEvent
            ? "linear-gradient(90deg,#c9a227,#f5d06e)"
            : "linear-gradient(90deg,#00ff88,#00cc66)"
        }} />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge color={isResolved ? "default" : isEvent ? "gold" : "green"}>
                  {isResolved ? "Resolved" : isEvent ? "Event" : "Price"}
                </Badge>
                {!isEvent && feedInfo && <Badge color="blue">{feedInfo.symbol}</Badge>}
                {hasMine && <Badge color="blue">Your bet</Badge>}
                {needsMoreOptions && <Badge color="gold">Setup needed</Badge>}
                {bettingClosed && !isResolved && <Badge color="red">Betting closed</Badge>}
              </div>
              <h3 className="text-sm font-display tracking-wide text-white leading-snug line-clamp-2">
                {acc.question}
              </h3>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-dim border border-border flex items-center justify-center text-white/40 hover:text-white transition-colors text-xs"
            >
              {expanded ? "▲" : "▼"}
            </button>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-mono text-white/30 mb-3 flex-wrap">
            {!isEvent && <span>{qTypeLabel(acc.questionType)}</span>}
            <span>
              {isResolved ? "Resolved" : bettingClosed ? "Betting ended" : `Betting ends: ${timeLeft(acc.marketEndTime)}`}
            </span>
            {isEvent && acc.eventEndTime && (
              <span>Event ends: {timeLeft(acc.eventEndTime)}</span>
            )}
            <span>By: {shortKey(acc.authority)}</span>
          </div>

          {options.length > 0 && (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <OptionBar
                  key={i}
                  option={opt}
                  allOptions={options}
                  index={i}
                  isWinner={winnerIdx === i}
                  label={getOptionLabel(i, acc, isEvent)}
                  myOptionIndices={myOptionIndices}
                  onBuy={!isResolved && acc.started && !bettingClosed ? () => setBuyOption(i) : null}
                />
              ))}
            </div>
          )}

          {!acc.started && (
            <p className="text-[10px] font-mono text-white/25 mt-2">
              Market not started yet — options being added
            </p>
          )}

          {needsMoreOptions && (
            <div className="mt-3 p-3 rounded-xl border border-gold/20 bg-gold/5">
              <p className="text-[10px] font-mono text-gold/60 mb-2 uppercase tracking-widest">
                Add options to start market ({options.length}/{acc.numOptions})
              </p>
              <button
                onClick={handleAddOption}
                disabled={aol || aeol}
                className="text-xs font-mono text-black bg-gold hover:bg-gold/80 px-4 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
              >
                {aol || aeol ? "Adding…" : `+ Add Option ${options.length + 1}`}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {canResolve && (
              <button
                onClick={handleResolve}
                disabled={rpl}
                className="text-xs font-mono text-black bg-accent hover:bg-accent/80 px-4 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
              >
                {rpl ? "Resolving…" : "Resolve Market"}
              </button>
            )}
            {isEvent && !isResolved && eventResolveStatus === "can_resolve" && (
              <button
                onClick={handleResolveEvent}
                disabled={rel}
                className="text-xs font-mono text-black bg-gold hover:bg-gold/80 px-4 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
              >
                {rel ? "Resolving…" : "Resolve Market"}
              </button>
            )}
            {isEvent && !isResolved && eventResolveStatus === "quorum_pending" && (
              <span className="text-[10px] font-mono text-gold/50 flex items-center gap-1">
                ⏳ Quorum not yet reached
              </span>
            )}
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border/40 px-5 py-4">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">All Orders</p>
            <OrdersLoader market={market} isEvent={isEvent} myPublicKey={publicKey} />
          </div>
        )}
      </div>

      {buyOption !== null && (
        <BuyModal
          market={market}
          optionIndex={buyOption}
          isEvent={isEvent}
          onClose={() => setBuyOption(null)}
          onRefreshSingle={onRefreshSingle}
        />
      )}
    </>
  );
}

// ── Per-market orders loader ──────────────────────────────────────────────────
function useOrdersForMarket(marketPubkey) {
  const program = useProgram();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program || !marketPubkey) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await program.account.order.all().catch(() => []);
        const mKey = marketPubkey.toBase58();
        if (!cancelled) setOrders(all.filter((o) => o.account.market.toBase58() === mKey));
      } catch (e) {
        if (!cancelled) toast.error("Failed to load orders: " + (e?.message ?? "Unknown error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [program, marketPubkey?.toBase58()]);

  return { orders, loading };
}

function OrdersLoader({ market, isEvent, myPublicKey }) {
  const { orders, loading } = useOrdersForMarket(market.publicKey);
  if (loading) return <div className="text-[10px] font-mono text-white/20">Loading orders…</div>;
  if (!orders.length) return <div className="text-[10px] font-mono text-white/20">No orders yet.</div>;
  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {orders.map((o) => (
        <OrderRow
          key={o.publicKey.toBase58()}
          order={o}
          isMine={myPublicKey != null && o.account.buyer.toBase58() === myPublicKey.toBase58()}
          market={market}
          isEvent={isEvent}
        />
      ))}
    </div>
  );
}

// ── Claim Tab ─────────────────────────────────────────────────────────────────
function ClaimTab({ priceMarkets, eventMarkets, myOrders, onRefreshSingle }) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const { positions, loading, reload } = useClaimablePositions(
    priceMarkets, eventMarkets, myOrders, connection
  );

  useEffect(() => { if (publicKey) reload(); }, [publicKey, priceMarkets.length, eventMarkets.length, myOrders.length]);

  const handleClaimSuccess = useCallback((marketPubkey) => {
    onRefreshSingle(marketPubkey);
    setTimeout(() => reload(), 2000);
  }, [onRefreshSingle, reload]);

  if (!publicKey) return (
    <p className="text-white/20 font-mono text-sm text-center py-8">Connect your wallet to see claimable positions.</p>
  );

  if (loading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  );

  if (positions.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-white/20 font-mono text-sm">No claimable positions found.</p>
      <p className="text-white/10 font-mono text-xs mt-1">Positions appear here once you have tokens in resolved or pending markets.</p>
      <button onClick={reload} className="mt-4 px-4 py-2 rounded-xl border border-border text-white/30 hover:text-white text-xs font-mono transition-all">
        Refresh
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
          {positions.length} position{positions.length !== 1 ? "s" : ""} found
        </p>
        <button onClick={reload} className="text-[10px] font-mono text-white/30 hover:text-white transition-colors">↻ Refresh</button>
      </div>
      {positions.map((pos, i) => <ClaimCard key={i} position={pos} onSuccess={handleClaimSuccess} />)}
    </div>
  );
}

function ClaimCard({ position, onSuccess }) {
  const { market, isEvent, optionIndex, tokenMint, tokenBalance, isWinner } = position;
  const { toast } = useToast();
  const acc = market.account;
  const label = getOptionLabel(optionIndex, acc, isEvent);

  const handleSuccess = useCallback(() => {
    onSuccess(market.publicKey, isEvent);
  }, [market.publicKey, isEvent, onSuccess]);

  const { claimReward, loading: cl, error: ce } = useClaimReward(handleSuccess);
  const { claimEventReward, loading: el, error: ee } = useClaimEventReward(handleSuccess);

  useEffect(() => { if (ce) toast.error(ce); }, [ce]);
  useEffect(() => { if (ee) toast.error(ee); }, [ee]);

  const isResolved = acc.resolved;
  const statusColor =
    isWinner === true ? "border-accent/30 bg-accent/5" :
    isWinner === false ? "border-red-500/20 bg-red-500/5" :
    "border-border bg-panel";
  const canClaim = isResolved && tokenBalance > 0;

  const handleClaim = async () => {
    try {
      if (isEvent) await claimEventReward(market, tokenMint);
      else await claimReward(market, tokenMint);
      toast.success(isWinner ? "Reward claimed! 🎉" : "Tokens burned successfully.");
    } catch (e) {
      toast.error(e?.message ?? "Claim failed");
    }
  };

  return (
    <div className={`p-4 rounded-2xl border ${statusColor} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge color={isEvent ? "gold" : "green"}>{isEvent ? "Event" : "Price"}</Badge>
            {isResolved ? (
              isWinner ? <Badge color="green">Winner ✓</Badge> : <Badge color="red">Lost</Badge>
            ) : (
              <Badge color="default">Pending Resolution</Badge>
            )}
          </div>
          <p className="text-xs font-mono text-white/70 line-clamp-2 mb-1">{acc.question}</p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-white/30">
            <span>Option: <span className={isWinner ? "text-accent" : "text-white/50"}>{label}</span></span>
            <span>Balance: <span className="text-white/60">{(tokenBalance / 1e6).toFixed(2)} tokens</span></span>
          </div>
        </div>
        <div className="flex-shrink-0">
          {canClaim && (
            <button
              disabled={cl || el}
              onClick={handleClaim}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
                isWinner ? "bg-accent text-black hover:bg-accent/80" : "bg-white/10 text-white/50 hover:bg-white/20"
              }`}
            >
              {cl || el ? "Claiming…" : isWinner ? "Claim Reward" : "Burn Tokens"}
            </button>
          )}
          {!isResolved && <span className="text-[10px] font-mono text-white/25 whitespace-nowrap">Awaiting resolution</span>}
        </div>
      </div>
      {(ce || ee) && <ErrMsg msg={ce || ee} />}
      {isWinner && isResolved && (
        <div className="mt-2 pt-2 border-t border-accent/10">
          <p className="text-[10px] font-mono text-accent/60">🎉 You picked the winning option. Claim your share of the pool.</p>
        </div>
      )}
      {isWinner === false && isResolved && (
        <div className="mt-2 pt-2 border-t border-red-500/10">
          <p className="text-[10px] font-mono text-red-400/40">Burn your tokens to clear the position. No reward for this one.</p>
        </div>
      )}
    </div>
  );
}

// ── Create Price Market Modal ──────────────────────────────────────────────────
// FIX (add option): in the post-creation step, addOption receives market.publicKey
//   — a PublicKey — matching the hook's signature exactly.
// FIX (time ordering): Betting End (left) must be < Target Time (right).
// FIX (feeds): Only confirmed devnet pubkeys from PYTH_FEED_SYMBOLS.
function CreatePriceMarketModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [qType, setQType] = useState("greaterThanAtTime");
  const [feed, setFeed] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [percentage, setPercentage] = useState("");
  const [rangeLow, setRangeLow] = useState("");
  const [rangeHigh, setRangeHigh] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [marketEndTime, setMarketEndTime] = useState("");
  const [question, setQuestion] = useState("");
  const [rangeOptions, setRangeOptions] = useState([{ lower: "", upper: "" }, { lower: "", upper: "" }]);
  const [createdMarket, setCreatedMarket] = useState(null);
  const createdMarketRef = useRef(null);
  const [optionsAdded, setOptionsAdded] = useState(0);

  const program = useProgram();

  const { createMarket, loading, error } = useCreatePriceMarket(async (result) => {
    // result = { marketPda: PublicKey, nextId: number }
    let fullMarket = null;
    try {
      const acc = await program.account.priceMarket.fetch(result.marketPda);
      fullMarket = { publicKey: result.marketPda, account: acc };
    } catch {
      // fallback: create a minimal shell so addOption still gets the PublicKey
      fullMarket = { publicKey: result.marketPda, account: null };
    }
    setCreatedMarket(fullMarket);
    createdMarketRef.current = fullMarket;
    onCreated(fullMarket);
  });

  // FIX (add option): addOption takes a PublicKey — pass createdMarketRef.current.publicKey
  const { addOption, loading: aol, error: aoe } = useAddOptionDetails(() => {
    if (createdMarketRef.current) onCreated(createdMarketRef.current);
  });

  useEffect(() => { if (aoe) toast.error(aoe); }, [aoe]);

  // Only devnet-confirmed pubkeys from constants
  const feedOptions = useMemo(() =>
    Object.entries(PYTH_FEED_SYMBOLS).map(([pubkey, info]) => ({
      value: pubkey,
      label: `${info.symbol} — ${info.name}`,
    })),
  []);

  const qTypeOptions = [
    { value: "greaterThanAtTime", label: "Greater than price at time" },
    { value: "lessThanAtTime", label: "Less than price at time" },
    { value: "rangeAtTime", label: "Price in range at time" },
    { value: "percentageUp", label: "Price rises by %" },
    { value: "percentageDown", label: "Price drops by %" },
    { value: "rangeOfPrice", label: "Price range buckets (multi-option)" },
  ];

  const isRange = qType === "rangeOfPrice";
  const isPercent = qType === "percentageUp" || qType === "percentageDown";
  const isSingleRange = qType === "rangeAtTime";
  const needsTarget = !isPercent && !isRange && !isSingleRange;
  const numOptions = isRange ? rangeOptions.length : 2;
  const allOptionsAdded = optionsAdded >= numOptions;

  const buildQuestionType = () => {
    const feedPk = new PublicKey(feed);
    const t = Math.floor(new Date(targetTime).getTime() / 1000);
    if (qType === "greaterThanAtTime")
      return { greaterThanAtTime: { priceFeed: feedPk, targetPrice: new BN(parseInt(targetPrice)), time: new BN(t) } };
    if (qType === "lessThanAtTime")
      return { lessThanAtTime: { priceFeed: feedPk, targetPrice: new BN(parseInt(targetPrice)), time: new BN(t) } };
    if (qType === "rangeAtTime")
      return { rangeAtTime: { priceFeed: feedPk, upperBound: new BN(parseInt(rangeHigh)), lowerBound: new BN(parseInt(rangeLow)), time: new BN(t) } };
    if (qType === "percentageUp")
      return { percentageUp: { priceFeed: feedPk, percentage: parseInt(percentage), currentPrice: new BN(0), time: new BN(t) } };
    if (qType === "percentageDown")
      return { percentageDown: { priceFeed: feedPk, percentage: parseInt(percentage), currentPrice: new BN(0), time: new BN(t) } };
    if (qType === "rangeOfPrice")
      return {
        rangeOfPrice: {
          priceFeed: feedPk,
          options: rangeOptions.map((o) => ({
            upperBound: new BN(parseInt(o.upper)),
            lowerBound: new BN(parseInt(o.lower)),
          })),
          time: new BN(t),
        },
      };
    return null;
  };

  const submit = async () => {
    if (!feed) { toast.error("Please select a price feed"); return; }
    if (!question) { toast.error("Please enter a question"); return; }
    if (!marketEndTime) { toast.error("Please set a betting end time"); return; }
    if (!targetTime) { toast.error("Please set a target time"); return; }

    // FIX (time ordering): betting end must be before target time
    const metMs = new Date(marketEndTime).getTime();
    const ttMs = new Date(targetTime).getTime();
    if (metMs >= ttMs) {
      toast.error("Betting end time must be earlier than the target time");
      return;
    }

    let qt;
    try { qt = buildQuestionType(); } catch (e) {
      toast.error(e?.message ?? "Invalid parameters");
      return;
    }
    if (!qt) return;

    try {
      await createMarket({ questionTypeObj: qt, question, marketEndTime: Math.floor(metMs / 1000) });
      toast.success("Price market created!");
    } catch (e) {
      toast.error(e?.message ?? "Failed to create market");
    }
  };

  const handleAddOption = async () => {
    const mkt = createdMarketRef.current;
    if (!mkt?.publicKey) { toast.error("Market not ready — please try again"); return; }
    try {
      // FIX (add option): pass PublicKey directly — matches useAddOptionDetails signature
      await addOption(mkt.publicKey);
      setOptionsAdded((n) => n + 1);
      toast.success(`Option ${optionsAdded + 1} added`);
      if (createdMarketRef.current) onCreated(createdMarketRef.current);
    } catch (e) {
      toast.error(e?.message ?? "Failed to add option");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={createdMarket ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-lg p-8 rounded-2xl bg-panel border border-border shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono text-accent uppercase tracking-widest mb-0.5">New Market</p>
            <h2 className="font-display text-xl tracking-widest text-white">TOKEN PRICE MARKET</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>

        {!createdMarket && (
          <div className="space-y-4">
            <Input label="Question" value={question} onChange={setQuestion}
              placeholder="Will ETH be > $4000 on June 1?" required />
            <Select label="Question Type" value={qType} onChange={setQType} options={qTypeOptions} required />

            <Select
              label={`Price Feed (${feedOptions.length} devnet feeds)`}
              value={feed}
              onChange={setFeed}
              options={feedOptions}
              required
              searchable
            />

            {needsTarget && (
              <Input label="Target Price (USD, integer)" value={targetPrice}
                onChange={setTargetPrice} placeholder="e.g. 4000" type="number" required />
            )}
            {isSingleRange && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Lower Bound" value={rangeLow} onChange={setRangeLow} type="number" required />
                <Input label="Upper Bound" value={rangeHigh} onChange={setRangeHigh} type="number" required />
              </div>
            )}
            {isPercent && (
              <Input label="Percentage (%)" value={percentage} onChange={setPercentage}
                placeholder="e.g. 10" type="number" required />
            )}
            {isRange && (
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">
                  Price Range Options <span className="text-accent">*</span>
                </label>
                {rangeOptions.map((ro, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 mb-2">
                    <input type="number" placeholder={`Option ${i + 1} Low`} value={ro.lower}
                      onChange={(e) => { const n = [...rangeOptions]; n[i] = { ...n[i], lower: e.target.value }; setRangeOptions(n); }}
                      className="bg-dim border border-border rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
                    <input type="number" placeholder={`Option ${i + 1} High`} value={ro.upper}
                      onChange={(e) => { const n = [...rangeOptions]; n[i] = { ...n[i], upper: e.target.value }; setRangeOptions(n); }}
                      className="bg-dim border border-border rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
                  </div>
                ))}
                {rangeOptions.length < 5 && (
                  <button onClick={() => setRangeOptions([...rangeOptions, { lower: "", upper: "" }])}
                    className="text-xs font-mono text-accent/60 hover:text-accent transition-colors">
                    + Add range option
                  </button>
                )}
              </div>
            )}

            {/* FIX (time ordering): Betting End left, Target Time right */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                  Betting Ends <span className="text-accent">*</span>
                </label>
                <input type="datetime-local" value={marketEndTime} onChange={(e) => setMarketEndTime(e.target.value)}
                  className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
                <p className="text-[9px] font-mono text-white/20 mt-1">Must be before target time</p>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                  Target Time <span className="text-accent">*</span>
                </label>
                <input type="datetime-local" value={targetTime} onChange={(e) => setTargetTime(e.target.value)}
                  className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
                <p className="text-[9px] font-mono text-white/20 mt-1">When price is checked</p>
              </div>
            </div>

            {marketEndTime && targetTime && new Date(marketEndTime) >= new Date(targetTime) && (
              <p className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                ⚠ Betting end must be earlier than target time
              </p>
            )}

            <ErrMsg msg={error} />

            <button onClick={submit} disabled={loading || !question || !feed}
              className="w-full py-3 rounded-xl bg-accent text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-40">
              {loading ? "Creating…" : "Create Price Market →"}
            </button>
          </div>
        )}

        {createdMarket && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-accent/20 bg-accent/5">
              <p className="text-xs font-mono text-accent mb-1">✓ Market Created!</p>
              <p className="text-[10px] font-mono text-white/40">
                Now add {numOptions} option token mints to start the market.
              </p>
            </div>

            <div className="space-y-2">
              {Array.from({ length: numOptions }).map((_, i) => {
                const added = i < optionsAdded;
                const isNext = i === optionsAdded;
                const optLabel = isRange
                  ? `$${rangeOptions[i]?.lower} – $${rangeOptions[i]?.upper}`
                  : i === 0 ? "No" : "Yes";
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    added ? "border-accent/30 bg-accent/5" : isNext ? "border-white/20 bg-white/5" : "border-border/30 bg-dim/30 opacity-40"
                  }`}>
                    <div>
                      <p className={`text-xs font-mono font-semibold ${added ? "text-accent" : "text-white/60"}`}>
                        {added ? "✓ " : ""}{optLabel}
                      </p>
                      <p className="text-[9px] font-mono text-white/25">Option {i + 1}</p>
                    </div>
                    {isNext && (
                      <button
                        onClick={handleAddOption}
                        disabled={aol}
                        className="text-xs font-mono text-black bg-accent hover:bg-accent/80 px-3 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
                      >
                        {aol ? "Adding…" : "Add Option"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <ErrMsg msg={aoe} />

            {allOptionsAdded && (
              <div className="p-3 rounded-xl border border-accent/20 bg-accent/5 text-center">
                <p className="text-xs font-mono text-accent">🎉 Market is live! Betting is now open.</p>
              </div>
            )}

            <button onClick={onClose} className={`w-full py-3 rounded-xl font-mono font-bold text-sm uppercase tracking-widest transition-all ${
              allOptionsAdded ? "bg-accent text-black hover:bg-accent/90" : "bg-white/5 text-white/40 border border-border hover:bg-white/10"
            }`}>
              {allOptionsAdded ? "Done" : "Close (finish later)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Event Market Modal ──────────────────────────────────────────────────
// FIX (add option): addEventOption receives market.publicKey (a PublicKey).
// FIX (time ordering): Betting End (left) < Event End (right).
function CreateEventMarketModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [qType, setQType] = useState("optioned");
  const [question, setQuestion] = useState("");
  const [optionNames, setOptionNames] = useState(["YES", "NO"]);
  const [marketEndTime, setMarketEndTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [createdMarket, setCreatedMarket] = useState(null);
  const [optionsAdded, setOptionsAdded] = useState(0);
  const createdMarketRef = useRef(null);

  const numOptions = qType === "optioned" ? optionNames.length : 2;
  const allOptionsAdded = optionsAdded >= numOptions;
  const displayNames = qType === "optioned" ? optionNames : ["No", "Yes"];

  const program = useProgram();

  const { createEventMarket, loading, error } = useCreateEventMarket(async (result) => {
    // result = { marketPda: PublicKey, nextId: number }
    let fullMarket = null;
    try {
      const acc = await program.account.eventMarket.fetch(result.marketPda);
      fullMarket = { publicKey: result.marketPda, account: acc };
    } catch {
      fullMarket = { publicKey: result.marketPda, account: null };
    }
    setCreatedMarket(fullMarket);
    createdMarketRef.current = fullMarket;
    onCreated(fullMarket);
  });

  // FIX (add option): addEventOption takes a PublicKey
  const { addEventOption, loading: aeol, error: aeErr } = useAddEventOption(() => {
    if (createdMarketRef.current) onCreated(createdMarketRef.current);
  });

  useEffect(() => { if (aeErr) toast.error(aeErr); }, [aeErr]);

  const submit = async () => {
    if (!question) { toast.error("Please enter a question"); return; }
    if (!marketEndTime || !eventEndTime) { toast.error("Please set both end times"); return; }

    // FIX (time ordering): betting end must be before event end
    const metMs = new Date(marketEndTime).getTime();
    const eetMs = new Date(eventEndTime).getTime();
    if (metMs >= eetMs) {
      toast.error("Betting end time must be earlier than the event end time");
      return;
    }

    const questionTypeObj =
      qType === "optioned"
        ? { optioned: { options: optionNames.map((n) => ({ optionName: n })) } }
        : { binary: {} };

    try {
      await createEventMarket({
        questionTypeObj,
        question,
        marketEndTime: Math.floor(metMs / 1000),
        eventEndTime: Math.floor(eetMs / 1000),
      });
      toast.success("Event market created!");
    } catch (e) {
      toast.error(e?.message ?? "Failed to create event market");
    }
  };

  const handleAddOption = async () => {
    const mkt = createdMarketRef.current;
    if (!mkt?.publicKey) { toast.error("Market not ready — please try again"); return; }
    try {
      // FIX (add option): pass PublicKey directly — matches useAddEventOption signature
      await addEventOption(mkt.publicKey);
      setOptionsAdded((n) => n + 1);
      toast.success(`Option ${optionsAdded + 1} added`);
      if (createdMarketRef.current) onCreated(createdMarketRef.current);
    } catch (e) {
      toast.error(e?.message ?? "Failed to add option");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={createdMarket ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-panel border border-border shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono text-gold uppercase tracking-widest mb-0.5">New Market</p>
            <h2 className="font-display text-xl tracking-widest text-white">EVENT MARKET</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>

        {!createdMarket && (
          <div className="space-y-4">
            <Input label="Question" value={question} onChange={setQuestion}
              placeholder="Will RCB win today's match?" required />

            <Select label="Question Type" value={qType} onChange={setQType}
              options={[
                { value: "optioned", label: "Custom Options" },
                { value: "binary", label: "Binary (Yes / No)" },
              ]} required />

            {qType === "optioned" && (
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">
                  Options <span className="text-gold">*</span>
                </label>
                {optionNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input value={name}
                      onChange={(e) => { const n = [...optionNames]; n[i] = e.target.value; setOptionNames(n); }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-dim border border-border rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-gold/50 transition-all" />
                    {optionNames.length > 2 && (
                      <button onClick={() => setOptionNames(optionNames.filter((_, j) => j !== i))}
                        className="text-white/30 hover:text-red-400 transition-colors text-sm">✕</button>
                    )}
                  </div>
                ))}
                {optionNames.length < 5 && (
                  <button onClick={() => setOptionNames([...optionNames, ""])}
                    className="text-xs font-mono text-gold/60 hover:text-gold transition-colors">
                    + Add option
                  </button>
                )}
              </div>
            )}

            {/* FIX (time ordering): Betting End left, Event End right */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                  Betting Ends <span className="text-gold">*</span>
                </label>
                <input type="datetime-local" value={marketEndTime} onChange={(e) => setMarketEndTime(e.target.value)}
                  className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-gold/50 transition-all" />
                <p className="text-[9px] font-mono text-white/20 mt-1">Must be before event end</p>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                  Event Ends <span className="text-gold">*</span>
                </label>
                <input type="datetime-local" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)}
                  className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-gold/50 transition-all" />
                <p className="text-[9px] font-mono text-white/20 mt-1">When event resolves</p>
              </div>
            </div>

            {marketEndTime && eventEndTime && new Date(marketEndTime) >= new Date(eventEndTime) && (
              <p className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                ⚠ Betting end must be earlier than event end time
              </p>
            )}

            <ErrMsg msg={error} />

            <button onClick={submit} disabled={loading || !question || !marketEndTime || !eventEndTime}
              className="w-full py-3 rounded-xl bg-gold text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-gold/90 transition-all disabled:opacity-40">
              {loading ? "Creating…" : "Create Event Market →"}
            </button>
          </div>
        )}

        {createdMarket && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-gold/20 bg-gold/5">
              <p className="text-xs font-mono text-gold mb-1">✓ Event Market Created!</p>
              <p className="text-[10px] font-mono text-white/40">
                Now add {numOptions} option token mints to start the market.
              </p>
            </div>

            <div className="space-y-2">
              {Array.from({ length: numOptions }).map((_, i) => {
                const added = i < optionsAdded;
                const isNext = i === optionsAdded;
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    added ? "border-gold/30 bg-gold/5" : isNext ? "border-white/20 bg-white/5" : "border-border/30 bg-dim/30 opacity-40"
                  }`}>
                    <div>
                      <p className={`text-xs font-mono font-semibold ${added ? "text-gold" : "text-white/60"}`}>
                        {added ? "✓ " : ""}{displayNames[i] || `Option ${i + 1}`}
                      </p>
                      <p className="text-[9px] font-mono text-white/25">Option {i + 1}</p>
                    </div>
                    {isNext && (
                      <button
                        onClick={handleAddOption}
                        disabled={aeol}
                        className="text-xs font-mono text-black bg-gold hover:bg-gold/80 px-3 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
                      >
                        {aeol ? "Adding…" : "Add Option"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <ErrMsg msg={aeErr} />

            {allOptionsAdded && (
              <div className="p-3 rounded-xl border border-gold/20 bg-gold/5 text-center">
                <p className="text-xs font-mono text-gold">🎉 Event market is live! Betting is now open.</p>
              </div>
            )}

            <button onClick={onClose} className={`w-full py-3 rounded-xl font-mono font-bold text-sm uppercase tracking-widest transition-all ${
              allOptionsAdded ? "bg-gold text-black hover:bg-gold/90" : "bg-white/5 text-white/40 border border-border hover:bg-white/10"
            }`}>
              {allOptionsAdded ? "Done" : "Close (finish later)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ userAccount, priceMarkets, eventMarkets, myOrders, onRefreshSingle, onRefresh }) {
  const { publicKey } = useWallet();
  const [subTab, setSubTab] = useState("orders");

  const myPriceMarkets = priceMarkets.filter(
    (m) => publicKey != null && m.account.authority?.toBase58() === publicKey.toBase58()
  );
  const myEventMarkets = eventMarkets.filter(
    (m) => publicKey != null && m.account.authority?.toBase58() === publicKey.toBase58()
  );

  const data = userAccount?.data;
  const solWon = data?.totalWonAmount ? lamToSol(data.totalWonAmount) : "0";

  return (
    <div>
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Username", val: data.username, accent: "text-accent" },
            { label: "Total Orders", val: data.totalOrders?.toString() ?? "0", accent: "text-white" },
            { label: "Total Won", val: `${solWon} SOL`, accent: "text-gold" },
            { label: "Wallet", val: shortKey(data.pubkey), accent: "text-white/60" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-2xl bg-panel border border-border">
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-base font-mono font-bold ${s.accent}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-dim border border-border w-fit">
        {["orders", "claims", "my markets"].map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              subTab === t ? "bg-accent text-black" : "text-white/40 hover:text-white"
            }`}>
            {t}
            {t === "orders" && <span className="ml-1.5 text-[9px] opacity-60">{myOrders.length}</span>}
            {t === "my markets" && <span className="ml-1.5 text-[9px] opacity-60">{myPriceMarkets.length + myEventMarkets.length}</span>}
          </button>
        ))}
      </div>

      {subTab === "orders" && (
        <div className="space-y-1.5">
          {myOrders.length === 0 ? (
            <p className="text-white/20 font-mono text-sm text-center py-8">No orders yet.</p>
          ) : (
            myOrders.map((o) => {
              const mkt = [...priceMarkets, ...eventMarkets].find(
                (m) => m.publicKey.toBase58() === o.account.market.toBase58()
              );
              const isEvent = eventMarkets.some((m) => m.publicKey.toBase58() === o.account.market.toBase58());
              const optLabel = mkt
                ? getOptionLabel(o.account.option, mkt.account, isEvent)
                : `Option ${o.account.option + 1}`;
              return (
                <div key={o.publicKey.toBase58()}
                  className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono text-white/60 mb-0.5">
                      {mkt?.account?.question ?? shortKey(o.account.market)}
                    </p>
                    <p className="text-[10px] font-mono text-accent">
                      {optLabel} • Qty: {o.account.quantity.toString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-white/25 whitespace-nowrap">
                    {tsToDate(o.account.timeStamp)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {subTab === "claims" && (
        <ClaimTab
          priceMarkets={priceMarkets}
          eventMarkets={eventMarkets}
          myOrders={myOrders}
          onRefreshSingle={(pk) => {
            const isEv = eventMarkets.some((m) => m.publicKey.toBase58() === pk.toBase58());
            onRefreshSingle(pk, isEv);
          }}
        />
      )}

      {subTab === "my markets" && (
        <div className="space-y-4">
          {myPriceMarkets.length === 0 && myEventMarkets.length === 0 ? (
            <p className="text-white/20 font-mono text-sm text-center py-8">No markets created yet.</p>
          ) : (
            <>
              {myPriceMarkets.map((m) => (
                <MarketCard key={m.publicKey.toBase58()} market={m} isEvent={false}
                  myOrders={myOrders} onRefreshSingle={(pk) => onRefreshSingle(pk, false)} isMyMarket={true} />
              ))}
              {myEventMarkets.map((m) => (
                <MarketCard key={m.publicKey.toBase58()} market={m} isEvent={true}
                  myOrders={myOrders} onRefreshSingle={(pk) => onRefreshSingle(pk, true)} isMyMarket={true} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Auth Gate ─────────────────────────────────────────────────────────────────
function AuthGate() {
  return (
    <div className="relative min-h-screen grid-bg flex items-center justify-center px-6">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-accent/5 blur-[180px] pointer-events-none" />
      <div className="relative z-10 text-center max-w-md">
        <div className="mb-8">
          <span className="text-[10px] font-mono text-accent uppercase tracking-[0.3em] block mb-3">OracleX</span>
          <h1 className="font-display text-5xl tracking-widest text-white mb-3">
            PREDICTION <span className="text-accent">MARKETS</span>
          </h1>
          <p className="text-white/30 text-xs font-mono leading-relaxed">
            Decentralized prediction markets on Solana.<br />Connect your wallet to participate.
          </p>
        </div>
        <div className="p-8 rounded-2xl border border-border bg-panel/80 backdrop-blur-sm">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="font-mono text-sm font-semibold text-white mb-2 uppercase tracking-widest">Wallet Required</h2>
          <p className="text-white/30 text-xs font-mono mb-6 leading-relaxed">
            Connect a Solana wallet to browse markets, place bets, and claim rewards.
          </p>
          <a href="/" className="block w-full py-3 rounded-xl bg-white/5 border border-border text-white/50 hover:text-white hover:border-accent/30 hover:bg-accent/5 font-mono font-semibold text-xs uppercase tracking-widest transition-all text-center">
            ← Go Back to Home
          </a>
          <p className="text-[10px] font-mono text-white/20 mt-4">Use the wallet button in the navigation to connect.</p>
        </div>
        <p className="text-[10px] font-mono text-white/15 mt-6">Devnet • OracleX v1</p>
      </div>
    </div>
  );
}

// ── Inner page ────────────────────────────────────────────────────────────────
function PredictionMarketPlaceInner() {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { status, userAccount } = useCheckUser();
  const {
    priceMarkets, eventMarkets, loading, error,
    refresh, refreshSinglePriceMarket, refreshSingleEventMarket,
  } = useMarkets();
  const { myOrders } = useMyOrders();
  const daoTotalStake = useDaoTotalStake();

  useEffect(() => {
    if (error) toast.error(`Failed to load markets: ${error}`);
  }, [error]);

  const [mainTab, setMainTab] = useState("markets");
  const [marketCat, setMarketCat] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showCreatePrice, setShowCreatePrice] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const refreshSingle = useCallback(
    (marketPubkey, isEvent) => {
      if (isEvent) refreshSingleEventMarket(marketPubkey);
      else refreshSinglePriceMarket(marketPubkey);
    },
    [refreshSinglePriceMarket, refreshSingleEventMarket]
  );

  const filteredPriceMarkets = useMemo(() =>
    priceMarkets.filter((m) => statusFilter === "active" ? !m.account.resolved : m.account.resolved),
    [priceMarkets, statusFilter]
  );
  const filteredEventMarkets = useMemo(() =>
    eventMarkets.filter((m) => statusFilter === "active" ? !m.account.resolved : m.account.resolved),
    [eventMarkets, statusFilter]
  );

  const showPrice = marketCat === "all" || marketCat === "price";
  const showEvent = marketCat === "all" || marketCat === "event";

  const totalActive = useMemo(() =>
    priceMarkets.filter((m) => !m.account.resolved).length +
    eventMarkets.filter((m) => !m.account.resolved).length,
    [priceMarkets, eventMarkets]
  );

  const handlePriceMarketCreated = useCallback(() => refresh(), [refresh]);
  const handleEventMarketCreated = useCallback(() => refresh(), [refresh]);

  if (!publicKey) return <AuthGate />;

  return (
    <div className="relative min-h-screen grid-bg">
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] rounded-full bg-accent/3 blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <span className="text-[10px] font-mono text-accent uppercase tracking-[0.2em] block mb-1">OracleX</span>
            <h1 className="font-display text-4xl tracking-widest text-white">
              PREDICTION <span className="text-accent">MARKETS</span>
            </h1>
            <p className="text-white/30 text-xs font-mono mt-1">
              {totalActive} active markets • Devnet •
              <span className="ml-1 text-accent/40">{Object.keys(PYTH_FEED_SYMBOLS).length} Pyth feeds</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="px-3 py-2 rounded-xl border border-border bg-panel hover:border-accent/30 text-white/40 hover:text-white transition-all text-xs font-mono">
              ↻
            </button>
            {(status === "normal" || status === "dao") && (
              <>
                <button onClick={() => setShowCreatePrice(true)}
                  className="px-4 py-2 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-black transition-all text-xs font-mono font-semibold">
                  + Price Market
                </button>
                <button onClick={() => setShowCreateEvent(true)}
                  className="px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold hover:bg-gold hover:text-black transition-all text-xs font-mono font-semibold">
                  + Event Market
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1 mb-8 p-1 rounded-xl bg-dim border border-border w-fit">
          <Pill active={mainTab === "markets"} onClick={() => setMainTab("markets")}>Markets</Pill>
          <Pill active={mainTab === "profile"} onClick={() => setMainTab("profile")}>My Profile</Pill>
        </div>

        {mainTab === "profile" ? (
          <ProfileTab
            userAccount={userAccount}
            priceMarkets={priceMarkets}
            eventMarkets={eventMarkets}
            myOrders={myOrders}
            onRefreshSingle={refreshSingle}
            onRefresh={refresh}
          />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="flex gap-1 p-1 rounded-xl bg-dim border border-border">
                {[{ v: "all", l: "All" }, { v: "price", l: "Token Price" }, { v: "event", l: "Events" }].map(({ v, l }) => (
                  <button key={v} onClick={() => setMarketCat(v)}
                    className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
                      marketCat === v ? "bg-white/15 text-white" : "text-white/30 hover:text-white"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-dim border border-border">
                {[{ v: "active", l: "Active" }, { v: "resolved", l: "Resolved" }].map(({ v, l }) => (
                  <button key={v} onClick={() => setStatusFilter(v)}
                    className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
                      statusFilter === v
                        ? v === "active" ? "bg-accent text-black" : "bg-white/15 text-white"
                        : "text-white/30 hover:text-white"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-white/25 ml-auto">
                {filteredPriceMarkets.length + filteredEventMarkets.length} shown
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52" />)}
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <p className="text-red-400 font-mono text-sm">{error}</p>
                <button onClick={refresh} className="mt-4 px-4 py-2 rounded-xl border border-border text-white/30 hover:text-white text-xs font-mono transition-all">
                  ↻ Retry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showPrice && filteredPriceMarkets.map((m) => (
                  <MarketCard
                    key={m.publicKey.toBase58()} market={m} isEvent={false}
                    myOrders={myOrders} daoTotalStake={daoTotalStake}
                    onRefreshSingle={(pk) => refreshSingle(pk, false)}
                    isMyMarket={publicKey != null && m.account.authority?.toBase58() === publicKey.toBase58()}
                  />
                ))}
                {showEvent && filteredEventMarkets.map((m) => (
                  <MarketCard
                    key={m.publicKey.toBase58()} market={m} isEvent={true}
                    myOrders={myOrders} daoTotalStake={daoTotalStake}
                    onRefreshSingle={(pk) => refreshSingle(pk, true)}
                    isMyMarket={publicKey != null && m.account.authority?.toBase58() === publicKey.toBase58()}
                  />
                ))}
                {(showPrice ? filteredPriceMarkets : []).length === 0 &&
                  (showEvent ? filteredEventMarkets : []).length === 0 && (
                    <div className="col-span-2 py-16 text-center">
                      <p className="text-white/20 font-mono text-sm">
                        No {statusFilter} {marketCat === "all" ? "" : marketCat} markets found.
                      </p>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </div>

      {showCreatePrice && (
        <CreatePriceMarketModal
          onClose={() => setShowCreatePrice(false)}
          onCreated={handlePriceMarketCreated}
        />
      )}
      {showCreateEvent && (
        <CreateEventMarketModal
          onClose={() => setShowCreateEvent(false)}
          onCreated={handleEventMarketCreated}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PredictionMarketPlace() {
  return (
    <ToastProvider>
      <PredictionMarketPlaceInner />
    </ToastProvider>
  );
}