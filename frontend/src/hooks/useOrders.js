import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "./useProgram";

// Returns all orders, optionally filtered by wallet and/or market pubkey
export function useOrders({ marketPubkey } = {}) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [orders, setOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setError(null);
    try {
      let all = await program.account.order.all().catch(() => []);

      // filter by market if provided
      if (marketPubkey) {
        const mKey = marketPubkey.toBase58();
        all = all.filter(
          (o) => o.account.market.toBase58() === mKey
        );
      }

      setOrders(all);

      if (publicKey) {
        const myKey = publicKey.toBase58();
        setMyOrders(all.filter((o) => o.account.buyer.toBase58() === myKey));
      }
    } catch (err) {
      console.error("useOrders:", err);
      setError(err?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [program, publicKey, marketPubkey?.toBase58()]);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, myOrders, loading, error, refresh: load };
}

// All orders by the current user (across all markets)
export function useMyOrders() {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!program || !publicKey) return;
    setLoading(true);
    try {
      const all = await program.account.order.all().catch(() => []);
      const myKey = publicKey.toBase58();
      setMyOrders(all.filter((o) => o.account.buyer.toBase58() === myKey));
    } catch (err) {
      console.error("useMyOrders:", err);
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { myOrders, loading, refresh: load };
}