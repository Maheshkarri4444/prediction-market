import { useState, useEffect, useCallback } from "react";
import { useProgram } from "./useProgram";

export function useMarkets() {
  const program = useProgram();
  const [priceMarkets, setPriceMarkets] = useState([]);
  const [eventMarkets, setEventMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setError(null);
    try {
      const [pm, em] = await Promise.all([
        program.account.market.all().catch(() => []),
        program.account.eventMarket.all().catch(() => []),
      ]);
      // Sort: unresolved first, then by id desc
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
    }
  }, [program]);

  useEffect(() => {
    load();
  }, [load]);

  return { priceMarkets, eventMarkets, loading, error, refresh: load };
}