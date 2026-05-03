import { useState, useEffect } from "react";
import { useProgram } from "../../hooks/useProgram";
import MarketCard from "./MarketCard";
import Spinner from "../ui/Spinner";

export default function MarketsFeed() {
  const program = useProgram();
  const [priceMarkets, setPriceMarkets] = useState([]);
  const [eventMarkets, setEventMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program) return;
    const load = async () => {
      setLoading(true);
      try {
        const [pm, em] = await Promise.allSettled([
          program.account.market.all(),
          program.account.eventMarket.all(),
        ]);
        if (pm.status === "fulfilled") setPriceMarkets(pm.value.slice(-4).reverse());
        if (em.status === "fulfilled") setEventMarkets(em.value.slice(-4).reverse());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [program]);

  const all = [
    ...priceMarkets.map((m) => ({ ...m, _type: "price" })),
    ...eventMarkets.map((m) => ({ ...m, _type: "event" })),
  ].slice(0, 4);

  return (
    <section className="max-w-7xl mx-auto px-6 mb-20">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-display text-3xl tracking-widest text-white">
          RECENT <span className="text-accent">MARKETS</span>
        </h2>
        <p className="text-xs font-mono text-muted">Devnet • Live data</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted text-sm">No markets found.</p>
          <p className="text-muted/60 text-xs mt-1">Make sure your IDL is set and program ID is correct.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {all.map((market) => (
            <MarketCard key={market.publicKey.toBase58()} market={market} type={market._type} />
          ))}
        </div>
      )}
    </section>
  );
}