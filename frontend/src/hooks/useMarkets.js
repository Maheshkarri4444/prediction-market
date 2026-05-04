import { useState, useEffect, useCallback, useRef } from "react";
import { useProgram } from "./useProgram";

export function useMarkets() {
  const program = useProgram();
  const [priceMarkets, setPriceMarkets] = useState([]);
  const [eventMarkets, setEventMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!program) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const pm = await program.account.market.all().catch(() => []);
      const em = await program.account.eventMarket.all().catch(() => []);

      const sort = (arr) =>
        [...arr].sort((a, b) => {
          if (a.account.resolved !== b.account.resolved)
            return a.account.resolved ? 1 : -1;
          try {
            return b.account.id.toNumber() - a.account.id.toNumber();
          } catch {
            return 0;
          }
        });
      setPriceMarkets(sort(pm));
      setEventMarkets(sort(em));
    } catch (err) {
      console.error("useMarkets:", err);
      setError(err?.message ?? "Failed to load markets");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [program]);

  // Refresh a single price market by its publicKey
  const refreshSinglePriceMarket = useCallback(
    async (marketPubkey) => {
      if (!program) return;
      try {
        const updated = await program.account.market.fetch(marketPubkey);
        setPriceMarkets((prev) =>
          prev.map((m) =>
            m.publicKey.toBase58() === marketPubkey.toBase58()
              ? { ...m, account: updated }
              : m
          )
        );
      } catch (err) {
        console.error("refreshSinglePriceMarket:", err);
        // fall back to full reload
        load();
      }
    },
    [program, load]
  );

  // Refresh a single event market by its publicKey
  const refreshSingleEventMarket = useCallback(
    async (marketPubkey) => {
      if (!program) return;
      try {
        const updated = await program.account.eventMarket.fetch(marketPubkey);
        setEventMarkets((prev) =>
          prev.map((m) =>
            m.publicKey.toBase58() === marketPubkey.toBase58()
              ? { ...m, account: updated }
              : m
          )
        );
      } catch (err) {
        console.error("refreshSingleEventMarket:", err);
        load();
      }
    },
    [program, load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const lastRefresh = useRef(0);
  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < 2000) return;
    lastRefresh.current = now;
    load();
  }, [load]);

  return {
    priceMarkets,
    eventMarkets,
    loading,
    error,
    refresh,
    refreshSinglePriceMarket,
    refreshSingleEventMarket,
    setPriceMarkets,
    setEventMarkets,
  };
}