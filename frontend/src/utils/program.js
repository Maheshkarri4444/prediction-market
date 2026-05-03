import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, RPC_ENDPOINT } from "../constants";


import idl from "../idl/prediction_market.json";

export const getProgram = (wallet) => {
  if (!idl) return null;
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl, provider);
};

export const getReadonlyProgram = () => {
    console.log("IDL:", idl);
  if (!idl) return null;
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
  });

  console.log("Provider created with dummy wallet:", provider);
  return new Program(idl, provider);
};

export const getConnection = () => new Connection(RPC_ENDPOINT, "confirmed");