import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { useProgram } from "./useProgram";
import { getUserPdaFromKey } from "./useCreateMarket";

// PRECISION constant matches the on-chain PRECISION = 1_000_000
export const PRECISION = 1_000_000;
export const LAMPORTS_PER_SOL = 1_000_000_000;

// Compute option price as a fraction 0..1
// Returns price in range [0, 1]
export function computeOptionPrice(option, allOptions) {
  try {
    const selectedPool =
      option.poolAmount.toNumber() + option.virtualPoolAmount.toNumber();
    const totalPool = allOptions.reduce(
      (sum, o) =>
        sum + o.poolAmount.toNumber() + o.virtualPoolAmount.toNumber(),
      0
    );
    if (totalPool === 0) return 0;
    return selectedPool / totalPool;
  } catch {
    return 0;
  }
}

// Compute required SOL for `quantity` tokens of a given option
export function computeRequiredSol(option, allOptions, quantity) {
  try {
    const selectedPool =
      option.poolAmount.toNumber() + option.virtualPoolAmount.toNumber();
    const totalPool = allOptions.reduce(
      (sum, o) =>
        sum + o.poolAmount.toNumber() + o.virtualPoolAmount.toNumber(),
      0
    );
    if (totalPool === 0) return 0;
    const price = (selectedPool * PRECISION) / totalPool; // scaled by PRECISION
    // required_amount = price * quantity / PRECISION * LAMPORTS_PER_SOL / PRECISION
    const required =
      (price * quantity * LAMPORTS_PER_SOL) / (PRECISION * PRECISION);
    return required / LAMPORTS_PER_SOL; // return in SOL
  } catch {
    return 0;
  }
}

export function useCreateOrder(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // market: full market object { publicKey, account }
  // optionIndex: number
  // quantity: number (in token units, e.g. 1_000_000 = 1 token with 6 decimals)
  const createOrder = async (market, optionIndex, quantity) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const [userPda] = getUserPdaFromKey(publicKey, program.programId);
      const userAcc = await program.account.user.fetch(userPda);
      const orderId = userAcc.totalOrders.toNumber() + 1;

      const [orderPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("buy_shares"),
          publicKey.toBuffer(),
          market.publicKey.toBuffer(),
          new BN(orderId).toArrayLike(Buffer, "be", 8),
        ],
        program.programId
      );

      const optionMint = new PublicKey(
        market.account.options[optionIndex].mint
      );

      const tokenAccount = await anchor.utils.token.associatedAddress({
        mint: optionMint,
        owner: publicKey,
      });

      // marketVault derived from seeds
      const [marketVault] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_vault"),
          market.account.authority.toBuffer(),
          market.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .createOrder(optionIndex, new BN(quantity))
        .accounts({
          buyer: publicKey,
          user: userPda,
          market: market.publicKey,
          tokenMint: optionMint,
          order: orderPda,
          marketVault: marketVault,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("createOrder:", err);
      setError(err?.message ?? "Order failed");
    } finally {
      setLoading(false);
    }
  };

  return { createOrder, loading, error, setError };
}

export function useCreateEventOrder(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createEventOrder = async (market, optionIndex, quantity) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const [userPda] = getUserPdaFromKey(publicKey, program.programId);
      const userAcc = await program.account.user.fetch(userPda);
      const orderId = userAcc.totalOrders.toNumber() + 1;

      const [orderPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("buy_shares"),
          publicKey.toBuffer(),
          market.publicKey.toBuffer(),
          new BN(orderId).toArrayLike(Buffer, "be", 8),
        ],
        program.programId
      );

      const optionMint = new PublicKey(
        market.account.options[optionIndex].mint
      );

      const tokenAccount = await anchor.utils.token.associatedAddress({
        mint: optionMint,
        owner: publicKey,
      });

      const [marketVault] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("event_market_vault"),
          market.account.authority.toBuffer(),
          market.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .createEventOrder(optionIndex, new BN(quantity))
        .accounts({
          buyer: publicKey,
          user: userPda,
          market: market.publicKey,
          tokenMint: optionMint,
          order: orderPda,
          marketVault: marketVault,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("createEventOrder:", err);
      setError(err?.message ?? "Event order failed");
    } finally {
      setLoading(false);
    }
  };

  return { createEventOrder, loading, error, setError };
}