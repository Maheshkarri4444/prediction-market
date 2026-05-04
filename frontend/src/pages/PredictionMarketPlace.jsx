import { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
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
import { PYTH_FEED_SYMBOLS } from "../constants";

// ── Helpers ────────────────────────────────────────────────────────────────────
const lamToSol = (bn) => {
  try { return (bn.toNumber() / 1e9).toFixed(4); } catch { return "0.0000"; }
};
const shortKey = (pk) => {
  const s = pk?.toBase58?.() ?? String(pk ?? "");
  return s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "—";
};
const tsToDate = (bn) => {
  try {
    return new Date(bn.toNumber() * 1000).toLocaleString();
  } catch { return "—"; }
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

// Question type label
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

// Get price feed pubkey from question type
const getPriceFeedFromQt = (qt) => {
  if (!qt) return null;
  for (const v of Object.values(qt)) {
    if (v?.priceFeed) return new PublicKey(v.priceFeed);
  }
  return null;
};

// Get target time from question type
const getTargetTime = (qt) => {
  if (!qt) return null;
  for (const v of Object.values(qt)) {
    if (v?.time) return v.time;
  }
  return null;
};

// Can resolve price market: target time passed AND not resolved
const canResolvePriceMarket = (acc) => {
  if (acc.resolved) return false;
  const targetTime = getTargetTime(acc.questionType);
  if (!targetTime) return false;
  try { return Date.now() > targetTime.toNumber() * 1000; } catch { return false; }
};

// Can resolve event market: event_end_time passed AND votes >= 10% total DAO stake AND not resolved
const canResolveEventMarket = (acc, daoTotalStake) => {
  if (acc.resolved) return false;
  try {
    const ended = Date.now() > acc.eventEndTime.toNumber() * 1000;
    if (!ended) return false;
    if (!daoTotalStake) return true; // if we don't have DAO data, just check time
    const totalVoted = (acc.options ?? []).reduce(
      (s, o) => s + (o.stakeVoted?.toNumber?.() ?? 0), 0
    );
    const quorum = daoTotalStake.toNumber() / 10;
    return totalVoted >= quorum;
  } catch { return false; }
};

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
        active
          ? "bg-accent text-black"
          : "text-white/40 hover:text-white hover:bg-white/5"
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

function Select({ label, value, onChange, options, required }) {
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
          <span className={`text-xs font-mono ${isWinner ? "text-accent font-bold" : "text-white/70"}`}>
            {label ?? `Option ${index + 1}`}
          </span>
          {isWinner && <Badge color="green">Winner</Badge>}
          {isMine && <Badge color="blue">Your bet</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-mono font-bold ${isWinner ? "text-accent" : "text-white"}`}>
            {pct}¢
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
        <span className="text-[9px] font-mono text-white/20">
          Pool: {lamToSol(option.poolAmount)} SOL
        </span>
        <span className="text-[9px] font-mono text-white/20">
          Virtual: {lamToSol(option.virtualPoolAmount)} SOL
        </span>
      </div>
    </div>
  );
}

// ── OrderRow ──────────────────────────────────────────────────────────────────
function OrderRow({ order, isMine, marketOptions }) {
  const optLabel = marketOptions?.[order.account.option]
    ? (marketOptions[order.account.option].optionName ?? `Option ${order.account.option + 1}`)
    : `Option ${order.account.option + 1}`;

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs font-mono transition-all ${
      isMine ? "bg-accent/8 border border-accent/20" : "bg-dim/40 border border-border/30"
    }`}>
      <div className="flex items-center gap-3">
        {isMine && <span className="text-accent text-[9px]">YOU</span>}
        <span className="text-white/40">{shortKey(order.account.buyer)}</span>
        <span className={isMine ? "text-accent" : "text-white/60"}>{optLabel}</span>
      </div>
      <div className="flex items-center gap-4 text-white/30">
        <span>Qty: {order.account.quantity.toString()}</span>
        <span>{tsToDate(order.account.timeStamp)}</span>
      </div>
    </div>
  );
}

// ── BuyModal ──────────────────────────────────────────────────────────────────
function BuyModal({ market, optionIndex, isEvent, onClose, onRefresh }) {
  const [qty, setQty] = useState("1000000");
  const { createOrder, loading: lo, error: eo, setError: seo } = useCreateOrder(onRefresh);
  const { createEventOrder, loading: le, error: ee, setError: see } = useCreateEventOrder(onRefresh);

  const options = market.account.options ?? [];
  const opt = options[optionIndex];
  const price = opt ? computeOptionPrice(opt, options) : 0;
  const estSol = opt ? (price * parseInt(qty || "0") / 1e6) : 0;

  const handle = async () => {
    if (isEvent) await createEventOrder(market, optionIndex, parseInt(qty));
    else await createOrder(market, optionIndex, parseInt(qty));
    onClose();
  };

  const label = isEvent
    ? (opt?.optionName ?? `Option ${optionIndex + 1}`)
    : `Option ${optionIndex + 1}`;
  const err = eo || ee;

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
            <span className="text-white font-bold">{(price * 100).toFixed(2)}¢</span>
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

        <ErrMsg msg={err} />

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
function MarketCard({ market, isEvent, myOrders, daoTotalStake, onRefresh, isMyMarket }) {
  const { publicKey } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [buyOption, setBuyOption] = useState(null);
  const { resolveMarket, loading: rpl } = useResolvePriceMarket(onRefresh);
  const { resolveEventMarket, loading: rel } = useResolveEventMarket(onRefresh);
  const { addOption, loading: aol } = useAddOptionDetails(onRefresh);
  const { addEventOption, loading: aeol } = useAddEventOption(onRefresh);

  const acc = market.account;
  const options = acc.options ?? [];
  const myOptionIndices = myOrders
    ?.filter((o) => o.account.market.toBase58() === market.publicKey.toBase58())
    ?.map((o) => o.account.option) ?? [];
  const hasMine = myOptionIndices.length > 0;

  const canResolve = isEvent
    ? canResolveEventMarket(acc, daoTotalStake)
    : canResolvePriceMarket(acc);

  const needsMoreOptions =
    isMyMarket && options.length < (acc.numOptions ?? 0) && !acc.started;

  const feedInfo = !isEvent ? getFeedInfo(getPriceFeedFromQt(acc.questionType)) : null;
  const winnerIdx =
    acc.resolved && acc.finalOutcome !== null && acc.finalOutcome !== undefined
      ? (typeof acc.finalOutcome === "object"
        ? Object.values(acc.finalOutcome)[0]
        : acc.finalOutcome)
      : null;

  return (
    <>
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          hasMine
            ? "border-accent/30 bg-panel"
            : acc.resolved
            ? "border-border/40 bg-panel/60"
            : "border-border bg-panel hover:border-accent/20"
        }`}
      >
        {/* top bar */}
        <div className="h-0.5 w-full" style={{
          background: acc.resolved
            ? "rgba(255,255,255,0.05)"
            : isEvent
            ? "linear-gradient(90deg,#c9a227,#f5d06e)"
            : "linear-gradient(90deg,#00ff88,#00cc66)"
        }} />

        <div className="p-5">
          {/* header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge color={acc.resolved ? "default" : isEvent ? "gold" : "green"}>
                  {acc.resolved ? "Resolved" : isEvent ? "Event" : "Price"}
                </Badge>
                {!isEvent && feedInfo && (
                  <Badge color="blue">{feedInfo.symbol}</Badge>
                )}
                {hasMine && <Badge color="blue">Your bet</Badge>}
                {needsMoreOptions && <Badge color="gold">Setup needed</Badge>}
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

          {/* meta */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-white/30 mb-3 flex-wrap">
            {!isEvent && (
              <span>{qTypeLabel(acc.questionType)}</span>
            )}
            <span>
              {acc.resolved ? "Ended" : `Ends: ${timeLeft(acc.marketEndTime)}`}
            </span>
            {isEvent && acc.eventEndTime && (
              <span>Event: {timeLeft(acc.eventEndTime)}</span>
            )}
            <span>By: {shortKey(acc.authority)}</span>
          </div>

          {/* options preview */}
          {options.length > 0 && (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <OptionBar
                  key={i}
                  option={opt}
                  allOptions={options}
                  index={i}
                  isWinner={winnerIdx === i}
                  label={isEvent ? (opt.optionName ?? `Option ${i + 1}`) : undefined}
                  myOptionIndices={myOptionIndices}
                  onBuy={!acc.resolved && acc.started ? () => setBuyOption(i) : null}
                />
              ))}
            </div>
          )}

          {!acc.started && (
            <p className="text-[10px] font-mono text-white/25 mt-2">
              Market not started yet — options being added
            </p>
          )}

          {/* action buttons */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {needsMoreOptions && (
              <button
                onClick={() => isEvent ? aeol : aol
                  ? null
                  : isEvent
                  ? null
                  : addOption(market.publicKey)
                }
                disabled={aol || aeol}
                className="text-xs font-mono text-black bg-gold hover:bg-gold/80 px-4 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
                onClick={() =>
                  isEvent
                    ? null // handled below
                    : addOption(market.publicKey)
                }
              >
                {aol ? "Adding…" : `Add Option (${options.length}/${acc.numOptions})`}
              </button>
            )}
            {needsMoreOptions && isEvent && (
              <button
                onClick={() => addEventOption(market.publicKey)}
                disabled={aeol}
                className="text-xs font-mono text-black bg-gold hover:bg-gold/80 px-4 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
              >
                {aeol ? "Adding…" : `Add Option (${options.length}/${acc.numOptions})`}
              </button>
            )}
            {canResolve && (
              <button
                onClick={() =>
                  isEvent
                    ? resolveEventMarket(market)
                    : resolveMarket(market, getPriceFeedFromQt(acc.questionType))
                }
                disabled={rpl || rel}
                className="text-xs font-mono text-black bg-accent hover:bg-accent/80 px-4 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-40"
              >
                {rpl || rel ? "Resolving…" : "Resolve Market"}
              </button>
            )}
          </div>
        </div>

        {/* expanded: all orders */}
        {expanded && (
          <div className="border-t border-border/40 px-5 py-4">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
              All Orders
            </p>
            <AllOrdersForMarket
              market={market}
              isEvent={isEvent}
              myPublicKey={publicKey}
            />
          </div>
        )}
      </div>

      {buyOption !== null && (
        <BuyModal
          market={market}
          optionIndex={buyOption}
          isEvent={isEvent}
          onClose={() => setBuyOption(null)}
          onRefresh={() => { setBuyOption(null); onRefresh(); }}
        />
      )}
    </>
  );
}

// Lazy order loader per card
function AllOrdersForMarket({ market, isEvent, myPublicKey }) {
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const { useProgram: _ } = {};
  const program = (() => {
    // We need useProgram here — use a workaround by importing from context
    const { useMemo: um } = { useMemo };
    return null; // placeholder — handled via parent hook below
  })();

  // We'll use useOrders inline
  return <OrdersLoader market={market} isEvent={isEvent} myPublicKey={myPublicKey} />;
}

function OrdersLoader({ market, isEvent, myPublicKey }) {
  const { useProgram: _u } = {};
  const program = (() => { try { return null; } catch { return null; } })();
  const { orders, loading } = useOrdersForMarket(market.publicKey);
  const options = market.account.options ?? [];

  if (loading) return <div className="text-[10px] font-mono text-white/20">Loading orders…</div>;
  if (!orders.length) return <div className="text-[10px] font-mono text-white/20">No orders yet.</div>;

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {orders.map((o, i) => (
        <OrderRow
          key={o.publicKey.toBase58()}
          order={o}
          isMine={myPublicKey && o.account.buyer.toBase58() === myPublicKey.toBase58()}
          marketOptions={options}
        />
      ))}
    </div>
  );
}

// Inline hook for per-market orders (to avoid lifting state)
function useOrdersForMarket(marketPubkey) {
  const program = useProgram_();
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [program, marketPubkey?.toBase58()]);

  return { orders, loading };
}

// We need to access useProgram inside a non-hook context workaround
// This is a hook wrapper component pattern
import { useEffect } from "react";
import { useProgram } from "../hooks/useProgram";
function useProgram_() { return useProgram(); }

// ── Create Price Market Modal ──────────────────────────────────────────────────
function CreatePriceMarketModal({ onClose, onRefresh }) {
  const [qType, setQType] = useState("greaterThanAtTime");
  const [feed, setFeed] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [percentage, setPercentage] = useState("");
  const [rangeLow, setRangeLow] = useState("");
  const [rangeHigh, setRangeHigh] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [marketEndTime, setMarketEndTime] = useState("");
  const [question, setQuestion] = useState("");
  const [rangeOptions, setRangeOptions] = useState([
    { lower: "", upper: "" },
    { lower: "", upper: "" },
  ]);

  const { createMarket, loading, error } = useCreatePriceMarket((result) => {
    onRefresh();
    onClose();
  });

  const feedOptions = Object.entries(PYTH_FEED_SYMBOLS).map(([k, v]) => ({
    value: k,
    label: `${v.symbol} — ${v.name}`,
  }));

  const qTypeOptions = [
    { value: "greaterThanAtTime", label: "Greater than price at time" },
    { value: "lessThanAtTime", label: "Less than price at time" },
    { value: "rangeAtTime", label: "Price in range at time" },
    { value: "percentageUp", label: "Price rises by %" },
    { value: "percentageDown", label: "Price drops by %" },
    { value: "rangeOfPrice", label: "Price range buckets (multi-option)" },
  ];

  const buildQuestionType = () => {
    const feedPk = feed;
    const t = Math.floor(new Date(targetTime).getTime() / 1000);
    if (qType === "greaterThanAtTime")
      return { greaterThanAtTime: { priceFeed: feedPk, targetPrice: parseInt(targetPrice), time: new BN(t) } };
    if (qType === "lessThanAtTime")
      return { lessThanAtTime: { priceFeed: feedPk, targetPrice: parseInt(targetPrice), time: new BN(t) } };
    if (qType === "rangeAtTime")
      return { rangeAtTime: { priceFeed: feedPk, upperBound: parseInt(rangeHigh), lowerBound: parseInt(rangeLow), time: new BN(t) } };
    if (qType === "percentageUp")
      return { percentageUp: { priceFeed: feedPk, percentage: parseInt(percentage), currentPrice: 0, time: new BN(t) } };
    if (qType === "percentageDown")
      return { percentageDown: { priceFeed: feedPk, percentage: parseInt(percentage), currentPrice: 0, time: new BN(t) } };
    if (qType === "rangeOfPrice")
      return {
        rangeOfPrice: {
          priceFeed: feedPk,
          options: rangeOptions.map((o) => ({
            upperBound: parseInt(o.upper),
            lowerBound: parseInt(o.lower),
          })),
          time: new BN(t),
        },
      };
    return null;
  };

  const submit = async () => {
    const qt = buildQuestionType();
    if (!qt) return;
    const met = Math.floor(new Date(marketEndTime).getTime() / 1000);
    await createMarket({ questionTypeObj: qt, question, marketEndTime: met });
  };

  const isRange = qType === "rangeOfPrice";
  const isPercent = qType === "percentageUp" || qType === "percentageDown";
  const isSingleRange = qType === "rangeAtTime";
  const needsTarget = !isPercent && !isRange && !isSingleRange;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg p-8 rounded-2xl bg-panel border border-border shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono text-accent uppercase tracking-widest mb-0.5">New Market</p>
            <h2 className="font-display text-xl tracking-widest text-white">TOKEN PRICE MARKET</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <Input label="Question" value={question} onChange={setQuestion}
            placeholder="Will ETH be > $4000 on June 1?" required />
          <Select label="Question Type" value={qType} onChange={setQType} options={qTypeOptions} required />
          <Select label="Price Feed" value={feed} onChange={setFeed} options={feedOptions} required />

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
                    onChange={(e) => {
                      const n = [...rangeOptions];
                      n[i] = { ...n[i], lower: e.target.value };
                      setRangeOptions(n);
                    }}
                    className="bg-dim border border-border rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
                  <input type="number" placeholder={`Option ${i + 1} High`} value={ro.upper}
                    onChange={(e) => {
                      const n = [...rangeOptions];
                      n[i] = { ...n[i], upper: e.target.value };
                      setRangeOptions(n);
                    }}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Target Time <span className="text-accent">*</span>
              </label>
              <input type="datetime-local" value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Betting Ends <span className="text-accent">*</span>
              </label>
              <input type="datetime-local" value={marketEndTime}
                onChange={(e) => setMarketEndTime(e.target.value)}
                className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-accent/50 transition-all" />
            </div>
          </div>

          <ErrMsg msg={error} />

          <button onClick={submit} disabled={loading || !question || !feed}
            className="w-full py-3 rounded-xl bg-accent text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-40">
            {loading ? "Creating…" : "Create Price Market"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Event Market Modal ─────────────────────────────────────────────────
function CreateEventMarketModal({ onClose, onRefresh }) {
  const [qType, setQType] = useState("optioned");
  const [question, setQuestion] = useState("");
  const [optionNames, setOptionNames] = useState(["YES", "NO"]);
  const [marketEndTime, setMarketEndTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");

  const { createEventMarket, loading, error } = useCreateEventMarket(() => {
    onRefresh();
    onClose();
  });

  const submit = async () => {
    const met = Math.floor(new Date(marketEndTime).getTime() / 1000);
    const eet = Math.floor(new Date(eventEndTime).getTime() / 1000);
    const questionTypeObj =
      qType === "optioned"
        ? { optioned: { options: optionNames.map((n) => ({ optionName: n })) } }
        : { binary: {} };
    await createEventMarket({ questionTypeObj, question, marketEndTime: met, eventEndTime: eet });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl bg-panel border border-border shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono text-gold uppercase tracking-widest mb-0.5">New Market</p>
            <h2 className="font-display text-xl tracking-widest text-white">EVENT MARKET</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>

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
                    onChange={(e) => {
                      const n = [...optionNames];
                      n[i] = e.target.value;
                      setOptionNames(n);
                    }}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Betting Ends <span className="text-gold">*</span>
              </label>
              <input type="datetime-local" value={marketEndTime}
                onChange={(e) => setMarketEndTime(e.target.value)}
                className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-gold/50 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">
                Event Ends <span className="text-gold">*</span>
              </label>
              <input type="datetime-local" value={eventEndTime}
                onChange={(e) => setEventEndTime(e.target.value)}
                className="w-full bg-dim border border-border rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-gold/50 transition-all" />
            </div>
          </div>

          <ErrMsg msg={error} />

          <button onClick={submit} disabled={loading || !question || !marketEndTime || !eventEndTime}
            className="w-full py-3 rounded-xl bg-gold text-black font-mono font-bold text-sm uppercase tracking-widest hover:bg-gold/90 transition-all disabled:opacity-40">
            {loading ? "Creating…" : "Create Event Market"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ userAccount, priceMarkets, eventMarkets, onRefresh }) {
  const { publicKey } = useWallet();
  const { myOrders } = useMyOrders();
  const [subTab, setSubTab] = useState("orders");

  const myPriceMarkets = priceMarkets.filter(
    (m) => m.account.authority.toBase58() === publicKey?.toBase58()
  );
  const myEventMarkets = eventMarkets.filter(
    (m) => m.account.authority.toBase58() === publicKey?.toBase58()
  );

  const data = userAccount?.data;
  const solWon = data?.totalWonAmount ? lamToSol(data.totalWonAmount) : "0";

  return (
    <div>
      {/* user stats */}
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

      {/* sub tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-dim border border-border w-fit">
        {["orders", "my markets"].map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
              subTab === t ? "bg-accent text-black" : "text-white/40 hover:text-white"
            }`}>
            {t}
            <span className="ml-1.5 text-[9px] opacity-60">
              {t === "orders" ? myOrders.length : myPriceMarkets.length + myEventMarkets.length}
            </span>
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
              const options = mkt?.account?.options ?? [];
              return (
                <div key={o.publicKey.toBase58()}
                  className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono text-white/60 mb-0.5">
                      {mkt?.account?.question ?? shortKey(o.account.market)}
                    </p>
                    <p className="text-[10px] font-mono text-accent">
                      Option {o.account.option + 1} • Qty: {o.account.quantity.toString()}
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

      {subTab === "my markets" && (
        <div className="space-y-4">
          {myPriceMarkets.length === 0 && myEventMarkets.length === 0 ? (
            <p className="text-white/20 font-mono text-sm text-center py-8">No markets created yet.</p>
          ) : (
            <>
              {myPriceMarkets.map((m) => (
                <MarketCard key={m.publicKey.toBase58()} market={m} isEvent={false}
                  myOrders={myOrders} onRefresh={onRefresh} isMyMarket={true} />
              ))}
              {myEventMarkets.map((m) => (
                <MarketCard key={m.publicKey.toBase58()} market={m} isEvent={true}
                  myOrders={myOrders} onRefresh={onRefresh} isMyMarket={true} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PredictionMarketPlace() {
  const { publicKey } = useWallet();
  const { status, userAccount } = useCheckUser();
  const { priceMarkets, eventMarkets, loading, error, refresh } = useMarkets();
  const { myOrders } = useMyOrders();

  const [mainTab, setMainTab] = useState("markets"); // markets | profile
  const [marketCat, setMarketCat] = useState("all"); // all | price | event
  const [statusFilter, setStatusFilter] = useState("active"); // active | resolved
  const [showCreatePrice, setShowCreatePrice] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // DAO total stake for event market resolve check (optional enhancement)
  const [daoTotalStake, setDaoTotalStake] = useState(null);

  const filteredPriceMarkets = useMemo(() => {
    return priceMarkets.filter((m) =>
      statusFilter === "active" ? !m.account.resolved : m.account.resolved
    );
  }, [priceMarkets, statusFilter]);

  const filteredEventMarkets = useMemo(() => {
    return eventMarkets.filter((m) =>
      statusFilter === "active" ? !m.account.resolved : m.account.resolved
    );
  }, [eventMarkets, statusFilter]);

  const showPrice = marketCat === "all" || marketCat === "price";
  const showEvent = marketCat === "all" || marketCat === "event";

  const totalActive = priceMarkets.filter((m) => !m.account.resolved).length
    + eventMarkets.filter((m) => !m.account.resolved).length;

  return (
    <div className="relative min-h-screen grid-bg">
      {/* ambient */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] rounded-full bg-accent/3 blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <span className="text-[10px] font-mono text-accent uppercase tracking-[0.2em] block mb-1">
              OracleX
            </span>
            <h1 className="font-display text-4xl tracking-widest text-white">
              PREDICTION <span className="text-accent">MARKETS</span>
            </h1>
            <p className="text-white/30 text-xs font-mono mt-1">
              {totalActive} active markets • Devnet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="px-3 py-2 rounded-xl border border-border bg-panel hover:border-accent/30 text-white/40 hover:text-white transition-all text-xs font-mono">
              ↻
            </button>
            {status === "normal" || status === "dao" ? (
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
            ) : null}
          </div>
        </div>

        {/* ── Main tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl bg-dim border border-border w-fit">
          <Pill active={mainTab === "markets"} onClick={() => setMainTab("markets")}>
            Markets
          </Pill>
          {publicKey && (
            <Pill active={mainTab === "profile"} onClick={() => setMainTab("profile")}>
              My Profile
            </Pill>
          )}
        </div>

        {mainTab === "profile" ? (
          <ProfileTab
            userAccount={userAccount}
            priceMarkets={priceMarkets}
            eventMarkets={eventMarkets}
            onRefresh={refresh}
          />
        ) : (
          <>
            {/* ── Category + Status filters ──────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              {/* category */}
              <div className="flex gap-1 p-1 rounded-xl bg-dim border border-border">
                {[
                  { v: "all", l: "All" },
                  { v: "price", l: "Token Price" },
                  { v: "event", l: "Events" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setMarketCat(v)}
                    className={`px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-wider transition-all ${
                      marketCat === v ? "bg-white/15 text-white" : "text-white/30 hover:text-white"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* status */}
              <div className="flex gap-1 p-1 rounded-xl bg-dim border border-border">
                {[
                  { v: "active", l: "Active" },
                  { v: "resolved", l: "Resolved" },
                ].map(({ v, l }) => (
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

            {/* ── Market grid ────────────────────────────────────────────────── */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52" />)}
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <p className="text-red-400 font-mono text-sm">{error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showPrice && filteredPriceMarkets.map((m) => (
                  <MarketCard
                    key={m.publicKey.toBase58()}
                    market={m}
                    isEvent={false}
                    myOrders={myOrders}
                    daoTotalStake={daoTotalStake}
                    onRefresh={refresh}
                    isMyMarket={publicKey && m.account.authority.toBase58() === publicKey.toBase58()}
                  />
                ))}
                {showEvent && filteredEventMarkets.map((m) => (
                  <MarketCard
                    key={m.publicKey.toBase58()}
                    market={m}
                    isEvent={true}
                    myOrders={myOrders}
                    daoTotalStake={daoTotalStake}
                    onRefresh={refresh}
                    isMyMarket={publicKey && m.account.authority.toBase58() === publicKey.toBase58()}
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
          onRefresh={refresh}
        />
      )}
      {showCreateEvent && (
        <CreateEventMarketModal
          onClose={() => setShowCreateEvent(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}