import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useProgram } from "./useProgram";
import {
  getMarketplacePda,
  getMarketplaceVaultPda,
  getDaoPda,
  getDaoVaultPda,
  getUserPdaFromKey,
} from "./useCreateMarket";

export function useResolvePriceMarket(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // market: the full market account object from program.account.market.all()
  // priceFeedPk: PublicKey of the price feed
  const resolveMarket = async (market, priceFeedPk) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const [marketplacePda] = getMarketplacePda(program.programId);
      const [marketplaceVault] = getMarketplaceVaultPda(
        marketplacePda,
        program.programId
      );

      await program.methods
        .resolveMarket()
        .accounts({
          resolver: publicKey,
          market: market.publicKey,
          priceFeed: priceFeedPk,
          predictionMarketplace: marketplacePda,
          predictionMarketplaceVault: marketplaceVault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("resolveMarket:", err);
      setError(err?.message ?? "Resolve failed");
    } finally {
      setLoading(false);
    }
  };

  return { resolveMarket, loading, error };
}

export function useResolveEventMarket(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resolveEventMarket = async (market) => {
    if (!program || !publicKey) return;
    setError("");
    setLoading(true);
    try {
      const [userPda] = getUserPdaFromKey(publicKey, program.programId);
      const [daoPda] = getDaoPda(program.programId);
      const [daoVault] = getDaoVaultPda(program.programId);

      // marketVault: derived from event_market_vault seeds
      const [marketVault] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("event_market_vault"),
          market.account.authority.toBuffer(),
          market.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .resolveEventMarket()
        .accounts({
          resolver: publicKey,
          user: userPda,
          market: market.publicKey,
          marketVault: marketVault,
          dao: daoPda,
          daoVault: daoVault,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("resolveEventMarket:", err);
      setError(err?.message ?? "Resolve failed");
    } finally {
      setLoading(false);
    }
  };

  return { resolveEventMarket, loading, error };
}