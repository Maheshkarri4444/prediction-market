import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { useProgram } from "./useProgram";
import { getDaoPda, getDaoUserPda, getDaoStakeAccountPda } from "./useDaoData";

export function useStake(onSuccess) {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [error, setError] = useState("");

  const stake = async (amountSol) => {
    if (!program || !publicKey) return;
    setError("");
    setStaking(true);
    try {
      const lamports = new BN(Math.floor(amountSol * 1_000_000_000));

      const [daoPda] = getDaoPda(program.programId);
      const [daoUserPda] = getDaoUserPda(publicKey, program.programId);
      const [daoStakeAccount] = getDaoStakeAccountPda(program.programId);

      await program.methods
        .stake(lamports)
        .accounts({
          user: publicKey,
          daoUser: daoUserPda,
          dao: daoPda,
          daoStakeAccount: daoStakeAccount,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("Stake error:", err);
      setError(err?.message ?? "Stake failed");
    } finally {
      setStaking(false);
    }
  };

  const unstake = async (amountSol) => {
    if (!program || !publicKey) return;
    setError("");
    setUnstaking(true);
    try {
      // Only free_amount is unstakable — caller should validate this before calling
      const lamports = new BN(Math.floor(amountSol * 1_000_000_000));

      const [daoPda] = getDaoPda(program.programId);
      const [daoUserPda] = getDaoUserPda(publicKey, program.programId);
      const [daoStakeAccount] = getDaoStakeAccountPda(program.programId);

      await program.methods
        .unstake(lamports)
        .accounts({
          user: publicKey,
          daoUser: daoUserPda,
          dao: daoPda,
          daoStakeAccount: daoStakeAccount,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      onSuccess?.();
    } catch (err) {
      console.error("Unstake error:", err);
      setError(err?.message ?? "Unstake failed");
    } finally {
      setUnstaking(false);
    }
  };

  return { stake, unstake, staking, unstaking, error, setError };
}