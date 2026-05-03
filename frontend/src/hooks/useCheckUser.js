import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "./useProgram";
import { getUserPda, getDaoUserPda } from "../utils/pdas";

export const useCheckUser = () => {
  const { publicKey, connected } = useWallet();
  const program = useProgram();
  const [status, setStatus] = useState("idle");
  const [userAccount, setUserAccount] = useState(null);

  useEffect(() => {
    if (!connected || !publicKey || !program) {
      setStatus("idle");
      setUserAccount(null);
      return;
    }
    const check = async () => {
      setStatus("checking");
      try {
        const [userPda] = getUserPda(publicKey);
        try {
          const acc = await program.account.user.fetch(userPda);
          setUserAccount({ type: "normal", pda: userPda, data: acc });
          setStatus("normal");
          return;
        } catch (_) {}

        const [daoUserPda] = getDaoUserPda(publicKey);
        try {
          const acc = await program.account.daoUser.fetch(daoUserPda);
          setUserAccount({ type: "dao", pda: daoUserPda, data: acc });
          setStatus("dao");
          return;
        } catch (_) {}

        setStatus("none");
        setUserAccount(null);
      } catch (err) {
        console.error("Error checking user:", err);
        setStatus("none");
      }
    };
    check();
  }, [connected, publicKey, program]);

  return { status, userAccount };
};