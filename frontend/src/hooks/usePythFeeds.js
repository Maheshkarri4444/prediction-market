// hooks/usePythFeeds.js — FIXED
//
// ROOT CAUSE OF PriceFeedError:
//   The Rust program calls SolanaPriceAccount::account_info_to_feed() which
//   requires the account to be a real Pyth push-oracle account on-chain.
//   On DEVNET only the 3 pubkeys in PYTH_FEED_SYMBOLS are valid.
//   Hermes feeds return mainnet hex feed IDs — these don't exist as on-chain
//   accounts on devnet, so every market created with a Hermes feed will
//   ALWAYS error with PriceFeedError at resolve time.
//
// FIX: Only expose the 3 confirmed devnet Pyth push-oracle pubkeys.
//      Do NOT fetch Hermes or show any other feeds in the dropdown.
//      When more devnet feeds are added to PYTH_FEED_SYMBOLS, they
//      automatically appear — no other changes needed.

import { useState, useEffect } from "react";
import { PYTH_FEED_SYMBOLS } from "../constants";

/**
 * Returns only the confirmed devnet Pyth push-oracle accounts.
 * These are the ONLY valid feeds for SolanaPriceAccount::account_info_to_feed
 * on devnet. Do not add Hermes/mainnet hex IDs here.
 */
export function usePythFeeds() {
  const [feedMap, setFeedMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Build a map of confirmed devnet pubkey → feed info.
    // No HTTP call needed — these are static, confirmed on-chain accounts.
    const map = {};
    for (const [pubkey, info] of Object.entries(PYTH_FEED_SYMBOLS)) {
      map[pubkey] = {
        symbol: info.symbol,
        name: info.name,
        assetType: "Crypto",
        feedId: null,
        solanaPubkey: pubkey, // base58, ready to pass to new PublicKey()
      };
    }
    setFeedMap(map);
    setLoading(false);
    setError(null);
  }, []);

  return { feedMap, loading, error };
}

/**
 * Merged hook — same interface the page expects.
 * staticFallback is merged in so nothing is ever blank.
 */
export function useMergedPythFeeds(staticFallback = {}) {
  const { feedMap, loading, error } = usePythFeeds();

  // feedMap already includes everything from PYTH_FEED_SYMBOLS,
  // so merging with staticFallback is a no-op but kept for API compat.
  const merged = { ...staticFallback, ...feedMap };

  return { feedMap: merged, loading, error };
}