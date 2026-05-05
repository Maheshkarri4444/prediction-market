import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { useProgram } from "./useProgram";

// ── PDA helpers ────────────────────────────────────────────────────────────────
export function getMarketplacePda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("predictionmarketplace_v1")],
    programId
  );
}

export function getMarketplaceVaultPda(marketplacePda, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("predictionmarketplace_vault"), marketplacePda.toBuffer()],
    programId
  );
}

export function getUserPdaFromKey(walletPk, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_v1"), walletPk.toBuffer()],
    programId
  );
}

export function getPriceMktPda(creatorPk, marketId, programId) {
  // marketId is a BN or number
  const idBuf = new BN(marketId).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), creatorPk.toBuffer(), idBuf],
    programId
  );
}

export function getPriceMktVaultPda(creatorPk, marketPda, programId) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("market_vault"),
      creatorPk.toBuffer(),
      marketPda.toBuffer(),
    ],
    programId
  );
}

export function getDaoPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao")],
    programId
  );
}

export function getDaoVaultPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao_vault")],
    programId
  );
}

export function getEventMktPda(creatorPk, marketId, programId) {
  const idBuf = new BN(marketId).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("event_market"), creatorPk.toBuffer(), idBuf],
    programId
  );
}

export function getEventMktVaultPda(creatorPk, marketPda, programId) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("event_market_vault"),
      creatorPk.toBuffer(),
      marketPda.toBuffer(),
    ],
    programId
  );
}

// ── useCreatePriceMarket ───────────────────────────────────────────────────────
export function useCreatePriceMarket(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // questionTypeObj shape (mirrors Rust enum):
  // { greaterThanAtTime: { priceFeed, targetPrice, time } }
  // { lessThanAtTime: ... } etc.
  const createMarket = async ({ questionTypeObj, question, marketEndTime }) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const [marketplacePda] = getMarketplacePda(program.programId);
      const marketplace =
        await program.account.predictionMarketPlaceDetails.fetch(marketplacePda);
      const nextId = marketplace.totalMarkets.toNumber() + 1;

      const [marketplaceVault] = getMarketplaceVaultPda(
        marketplacePda,
        program.programId
      );
      const [marketPda] = getPriceMktPda(publicKey, nextId, program.programId);
      const [marketVault] = getPriceMktVaultPda(
        publicKey,
        marketPda,
        program.programId
      );
      const [userPda] = getUserPdaFromKey(publicKey, program.programId);

      // Determine price feed pubkey — it comes in as a string from the form
      const feedKey = Object.values(questionTypeObj)[0]?.priceFeed;
      const priceFeedPk = feedKey ? new PublicKey(feedKey) : PublicKey.default;

      // Anchor requires PublicKey objects inside the enum variant, not strings.
      // The form sets priceFeed as a string address — convert it in-place.
      const variantKey = Object.keys(questionTypeObj)[0];
      const variantVal = questionTypeObj[variantKey];
      if (variantVal?.priceFeed && typeof variantVal.priceFeed === "string") {
        variantVal.priceFeed = new PublicKey(variantVal.priceFeed);
      }

      await program.methods
        .createMarket(
          questionTypeObj,
          question,
          new BN(marketEndTime)
        )
        .accounts({
          creator: publicKey,
          user: userPda,
          predictionMarketPlace: marketplacePda,
          predictionMarketVault: marketplaceVault,
          market: marketPda,
          marketVault: marketVault,
          priceFeed: priceFeedPk,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      onSuccess?.({ marketPda, nextId });
      return { marketPda, nextId };
    } catch (err) {
      console.error("createMarket:", err);
      setError(err?.message ?? "Create market failed");
    } finally {
      setLoading(false);
    }
  };

  return { createMarket, loading, error, setError };
}

// ── useAddOptionDetails ────────────────────────────────────────────────────────
export function useAddOptionDetails(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // marketPda: PublicKey
  const addOption = async (marketPda) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const mintKeypair = anchor.web3.Keypair.generate();
      await program.methods
        .addOptionDetails()
        .accounts({
          creator: publicKey,
          market: marketPda,
          tokenMint: mintKeypair.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([mintKeypair])
        .rpc();
      onSuccess?.();
    } catch (err) {
      console.error("addOptionDetails:", err);
      setError(err?.message ?? "Add option failed");
    } finally {
      setLoading(false);
    }
  };

  return { addOption, loading, error, setError };
}

// ── useCreateEventMarket ───────────────────────────────────────────────────────
export function useCreateEventMarket(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createEventMarket = async ({
    questionTypeObj, // { optioned: { options: [{optionName}...] } } or { binary: {} }
    question,
    marketEndTime,
    eventEndTime,
  }) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const [marketplacePda] = getMarketplacePda(program.programId);
      const marketplace =
        await program.account.predictionMarketPlaceDetails.fetch(marketplacePda);
      const nextId = marketplace.totalMarkets.toNumber() + 1;

      const [userPda] = getUserPdaFromKey(publicKey, program.programId);
      const [eventMktPda] = getEventMktPda(publicKey, nextId, program.programId);
      const [eventMktVault] = getEventMktVaultPda(
        publicKey,
        eventMktPda,
        program.programId
      );
      const [daoPda] = getDaoPda(program.programId);
      const [daoVault] = getDaoVaultPda(program.programId);

      await program.methods
        .createEventMarket(
          questionTypeObj,
          question,
          new BN(marketEndTime),
          new BN(eventEndTime)
        )
        .accounts({
          creator: publicKey,
          user: userPda,
          predictionMarketPlace: marketplacePda,
          market: eventMktPda,
          marketVault: eventMktVault,
          dao: daoPda,
          daoVault: daoVault,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      onSuccess?.({ marketPda: eventMktPda, nextId });
      return { marketPda: eventMktPda, nextId };
    } catch (err) {
      console.error("createEventMarket:", err);
      setError(err?.message ?? "Create event market failed");
    } finally {
      setLoading(false);
    }
  };

  return { createEventMarket, loading, error, setError };
}

// ── useAddEventOption ─────────────────────────────────────────────────────────
export function useAddEventOption(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addEventOption = async (marketPda) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const mintKeypair = anchor.web3.Keypair.generate();
      await program.methods
        .addOptionForEventMarket()
        .accounts({
          creator: publicKey,
          market: marketPda,
          tokenMint: mintKeypair.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([mintKeypair])
        .rpc();
      onSuccess?.();
    } catch (err) {
      console.error("addEventOption:", err);
      setError(err?.message ?? "Add event option failed");

    } finally {
      setLoading(false);
    }
  };

  return { addEventOption, loading, error, setError };
}