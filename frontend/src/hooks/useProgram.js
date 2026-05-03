import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getProgram, getReadonlyProgram } from "../utils/program";

export const useProgram = () => {
  const wallet = useWallet();
  const program = useMemo(() => {
    if (wallet.connected && wallet.publicKey) return getProgram(wallet);
    return getReadonlyProgram();
  }, [wallet.connected, wallet.publicKey]);
  return program;
};