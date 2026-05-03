import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import BN from "bn.js";
import { useProgram } from "./useProgram";
import { getDaoPda, getDaoUserPda, getVotePda } from "./useDaoData";

export function useVote(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  // marketPda: PublicKey, optionIndex: number (0-based), stakeAmountSol: number
  const vote = async (marketPda, optionIndex, stakeAmountSol) => {
    if (!program || !publicKey) return;
    setError("");
    setVoting(true);
    try {
      const lamports = new BN(Math.floor(stakeAmountSol * 1_000_000_000));

      const [daoPda] = getDaoPda(program.programId);
      const [daoUserPda] = getDaoUserPda(publicKey, program.programId);
      const [votePda] = getVotePda(publicKey, marketPda, program.programId);

      await program.methods
        .voteOnMarket(optionIndex, lamports)
        .accounts({
          voter: publicKey,
          dao: daoPda,
          daoUser: daoUserPda,
          market: marketPda,
          vote: votePda,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("Vote error:", err);
      setError(err?.message ?? "Vote failed");
    } finally {
      setVoting(false);
    }
  };

  return { vote, voting, error, setError };
}