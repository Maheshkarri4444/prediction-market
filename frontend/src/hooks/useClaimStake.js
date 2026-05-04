import { useState, useCallback } from "react";   
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useProgram } from "./useProgram";
export function useClaimStake(onSuccess) {
  const  program  = useProgram();
  const { publicKey } = useWallet();

  const [claiming, setClaiming] = useState(false);
  const [error, setError]       = useState("");

  /**
   * @param {PublicKey} votePda      – the Vote account PDA
   * @param {string}    marketKeyStr – base58 string of the EventMarket PDA
   */
  const claimStake = useCallback(
    async (votePda, marketKeyStr) => {
      if (!program || !publicKey) {
        setError("Wallet not connected.");
        return;
      }

      setError("");
      setClaiming(true);

      try {
        console.log("Claiming stake for votePda:", votePda.toBase58(), "marketKey:", marketKeyStr);
        const marketPk = new PublicKey(marketKeyStr);

        // Derive dao_user PDA
        const [daoUserPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("dao_user"), publicKey.toBuffer()],
          program.programId
        );

        // votePda can be passed in directly, but re-derive for safety
        const [derivedVotePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vote"), publicKey.toBuffer(), marketPk.toBuffer()],
          program.programId
        );

        await program.methods
          .claimStake()
          .accounts({
            user:          publicKey,
            daoUser:       daoUserPda,
            market:        marketPk,
            vote:          derivedVotePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        onSuccess?.(marketKeyStr);
      } catch (err) {
        console.error("claimStake error:", err);
        setError(err?.message ?? "Transaction failed.");
      } finally {
        setClaiming(false);
      }
    },
    [program, publicKey, onSuccess]
  );

  return { claimStake, claiming, error, setError };
}