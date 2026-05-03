import { useState, useEffect } from "react";
import { Connection } from "@solana/web3.js";
import Badge from "../ui/Badge";
import { timeUntil, formatPrice } from "../../utils/formatters";
import { PYTH_FEED_SYMBOLS, RPC_ENDPOINT } from "../../constants";

function getPythSymbol(feedAddress) {
  if (!feedAddress) return null;
  const key = feedAddress.toBase58?.() ?? feedAddress.toString?.();
  return PYTH_FEED_SYMBOLS[key] ?? null;
}

async function fetchPythPrice(feedPubkey, connection) {
  try {
    const accountInfo = await connection.getAccountInfo(feedPubkey);
    if (!accountInfo) return null;
    const data = accountInfo.data;
    const price = Number(data.readBigInt64LE(208));
    const expo = data.readInt32LE(20);
    return { price, expo };
  } catch {
    return null;
  }
}

export default function MarketCard({ market, type = "price" }) {
  const [pythData, setPythData] = useState(null);
  const acc = market.account;
  const isResolved = acc.resolved === true || (acc.finalOutcome !== undefined && acc.finalOutcome !== null);
  const endTime = acc.endTime?.toNumber?.() ?? acc.bettingEndTime?.toNumber?.();
  const question = acc.question ?? acc.marketQuestion ?? "—";

  useEffect(() => {
    if (type !== "price") return;
    const feedPubkey = acc.condition?.greaterThanAtTime?.priceFeed ?? acc.priceFeed;
    if (!feedPubkey) return;
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    fetchPythPrice(feedPubkey, connection).then(setPythData);
  }, [type, acc]);

  const feedPubkey = acc.condition?.greaterThanAtTime?.priceFeed;
  const pythSymbol = feedPubkey ? getPythSymbol(feedPubkey) : null;
  const totalPool = acc.options?.reduce((s, o) => s + (o.poolAmount?.toNumber?.() ?? 0), 0) ?? 0;

  return (
    <div className="group relative card-panel p-5 hover:border-accent/30 transition-all duration-300 hover:shadow-glow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={type === "price" ? "sky" : "gold"}>{type === "price" ? "📈 Price" : "🗳️ Event"}</Badge>
          <Badge variant={isResolved ? "muted" : "accent"}>{isResolved ? "Resolved" : endTime ? `⏱ ${timeUntil(endTime)}` : "Live"}</Badge>
        </div>
        {pythSymbol && (
          <div className="flex flex-col items-end shrink-0">
            <span className="font-mono text-xs text-muted">{pythSymbol.name}</span>
            {pythData
              ? <span className="font-mono text-sm text-accent">{formatPrice(pythData.price, pythData.expo)}</span>
              : <span className="font-mono text-xs text-muted animate-pulse">Loading…</span>}
          </div>
        )}
      </div>

      <h3 className="font-semibold text-white text-base leading-snug mb-4 group-hover:text-accent transition-colors duration-200">
        {question}
      </h3>

      {acc.options && acc.options.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {acc.options.map((opt, i) => {
            const optPool = opt.poolAmount?.toNumber?.() ?? 0;
            const pct = totalPool > 0 ? Math.round((optPool / totalPool) * 100) : 0;
            const isWinner = isResolved && (acc.winningOption === i || acc.finalOutcome === i || opt.isWinner === true);
            return (
              <div key={i} className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg border text-center transition-all duration-200 ${isWinner ? "border-accent bg-accent/10 text-accent" : "border-border bg-dim text-muted"}`}>
                <p className="text-xs font-mono mb-0.5">{opt.optionName ?? (i === 0 ? "YES" : "NO")}</p>
                <p className="font-display text-lg tracking-wide">{pct}%</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-mono text-muted border-t border-border pt-3 mt-2">
        <span>Pool: {(totalPool / 1e9).toFixed(4)} SOL</span>
        <span>{market.publicKey.toBase58().slice(0, 8)}…</span>
      </div>
    </div>
  );
}