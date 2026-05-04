import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useProgram } from "./useProgram";
import { useConnection } from "@solana/wallet-adapter-react";

/**
 * Hook for claiming winning rewards on price markets.
 */
export function useClaimReward(onSuccess) {
  const program = useProgram();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const claimReward = useCallback(
    async (market, tokenMintPubkey) => {
      if (!program || !publicKey) return;
      setLoading(true);
      setError(null);
      try {
        const acc = market.account;
        const marketPubkey = market.publicKey;

        const [userPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_v1"), publicKey.toBuffer()],
          program.programId
        );

        const [marketVault] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("market_vault"),
            acc.authority.toBuffer(),
            marketPubkey.toBuffer(),
          ],
          program.programId
        );

        const tokenAccount = getAssociatedTokenAddressSync(
          tokenMintPubkey,
          publicKey
        );

        await program.methods
          .claimWinningReward()
          .accounts({
            user: publicKey,
            userAccount: userPda,
            market: marketPubkey,
            marketVault: marketVault,
            tokenMint: tokenMintPubkey,
            tokenAccount: tokenAccount,
          })
          .rpc();

        if (onSuccess) onSuccess(market.publicKey);
      } catch (err) {
        console.error("claimReward:", err);
        setError(err?.message ?? "Failed to claim reward");
      } finally {
        setLoading(false);
      }
    },
    [program, publicKey, onSuccess]
  );

  return { claimReward, loading, error };
}

/**
 * Hook for claiming winning rewards on event markets.
 */
export function useClaimEventReward(onSuccess) {
  const program = useProgram();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const claimEventReward = useCallback(
    async (market, tokenMintPubkey) => {
      if (!program || !publicKey) return;
      setLoading(true);
      setError(null);
      try {
        const acc = market.account;
        const marketPubkey = market.publicKey;

        const [userPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_v1"), publicKey.toBuffer()],
          program.programId
        );

        const [marketVault] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("event_market_vault"),
            acc.authority.toBuffer(),
            marketPubkey.toBuffer(),
          ],
          program.programId
        );

        const tokenAccount = getAssociatedTokenAddressSync(
          tokenMintPubkey,
          publicKey
        );

        await program.methods
          .claimEventWinningReward()
          .accounts({
            buyer: publicKey,
            user: userPda,
            market: marketPubkey,
            tokenMint: tokenMintPubkey,
            marketVault: marketVault,
            tokenAccount: tokenAccount,
          })
          .rpc();

        if (onSuccess) onSuccess(market.publicKey);
      } catch (err) {
        console.error("claimEventReward:", err);
        setError(err?.message ?? "Failed to claim event reward");
      } finally {
        setLoading(false);
      }
    },
    [program, publicKey, onSuccess]
  );

  return { claimEventReward, loading, error };
}

/**
 * Checks how many tokens the user holds for a given mint.
 * Returns the token amount (u64 as number) or 0 if none.
 */
export async function getTokenBalance(connection, ownerPubkey, mintPubkey) {
  try {
    const ata = getAssociatedTokenAddressSync(mintPubkey, ownerPubkey);
    const bal = await connection.getTokenAccountBalance(ata);
    return bal.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Loads all claimable positions for the current user across
 * both price markets and event markets.
 *
 * Returns an array of objects:
 * {
 *   market,          // the full market object
 *   isEvent,         // boolean
 *   optionIndex,     // number
 *   tokenMint,       // PublicKey
 *   tokenBalance,    // number (raw, decimals = 6)
 *   isWinner,        // boolean | null (null = unresolved)
 * }
 */
export function useClaimablePositions(
  priceMarkets,
  eventMarkets,
  myOrders,
  connection
) {
  const { publicKey } = useWallet();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!publicKey || !connection) return;
    setLoading(true);
    try {
      const results = [];

      // ── Price markets ──────────────────────────────────────────────────────
      for (const m of priceMarkets) {
        const acc = m.account;
        // find orders by this user on this market
        const userOrdersForMarket = myOrders.filter(
          (o) =>
            o.account.market.toBase58() === m.publicKey.toBase58() &&
            o.account.buyer.toBase58() === publicKey.toBase58()
        );
        if (userOrdersForMarket.length === 0) continue;

        // Deduplicate by option index
        const optionsSeen = new Set();
        for (const order of userOrdersForMarket) {
          const optIdx = order.account.option;
          if (optionsSeen.has(optIdx)) continue;
          optionsSeen.add(optIdx);

          const optionData = acc.options?.[optIdx];
          if (!optionData) continue;

          const mintPk = new PublicKey(optionData.mint);
          const bal = await getTokenBalance(connection, publicKey, mintPk);
          if (bal <= 0) continue; // nothing to claim

          const winnerIdx =
            acc.resolved && acc.finalOutcome != null
              ? typeof acc.finalOutcome === "object"
                ? Object.values(acc.finalOutcome)[0]
                : acc.finalOutcome
              : null;

          results.push({
            market: m,
            isEvent: false,
            optionIndex: optIdx,
            tokenMint: mintPk,
            tokenBalance: bal,
            isWinner: winnerIdx !== null ? winnerIdx === optIdx : null,
          });
        }
      }

      // ── Event markets ──────────────────────────────────────────────────────
      for (const m of eventMarkets) {
        const acc = m.account;
        const userOrdersForMarket = myOrders.filter(
          (o) =>
            o.account.market.toBase58() === m.publicKey.toBase58() &&
            o.account.buyer.toBase58() === publicKey.toBase58()
        );
        if (userOrdersForMarket.length === 0) continue;

        const optionsSeen = new Set();
        for (const order of userOrdersForMarket) {
          const optIdx = order.account.option;
          if (optionsSeen.has(optIdx)) continue;
          optionsSeen.add(optIdx);

          const optionData = acc.options?.[optIdx];
          if (!optionData) continue;

          const mintPk = new PublicKey(optionData.mint);
          const bal = await getTokenBalance(connection, publicKey, mintPk);
          if (bal <= 0) continue;

          const winnerIdx =
            acc.resolved && acc.finalOutcome != null
              ? typeof acc.finalOutcome === "object"
                ? Object.values(acc.finalOutcome)[0]
                : acc.finalOutcome
              : null;

          results.push({
            market: m,
            isEvent: true,
            optionIndex: optIdx,
            tokenMint: mintPk,
            tokenBalance: bal,
            isWinner: winnerIdx !== null ? winnerIdx === optIdx : null,
          });
        }
      }

      setPositions(results);
    } catch (err) {
      console.error("useClaimablePositions:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, priceMarkets, eventMarkets, myOrders]);

  return { positions, loading, reload: load };
}