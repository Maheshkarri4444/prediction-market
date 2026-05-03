import { PublicKey } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";

export const NETWORK = "devnet";
export const RPC_ENDPOINT = clusterApiUrl("devnet");

// ⚠️ Replace with your deployed program ID
export const PROGRAM_ID = new PublicKey("HMYsLuDhjARNTLb5eTbZS6aiJSfHgZ1tDwkJTMF2tKs3");

export const PYTH_FEED_SYMBOLS = {
  EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw: { symbol: "ETH", name: "Ethereum" },
  J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix: { symbol: "SOL", name: "Solana" },
  HovQMDrbAgAYPCmaTfvBSS6RCmFVh6k2BVnMfnWCb1xU: { symbol: "BTC", name: "Bitcoin" },
};

export const DAO_CREATION_FEE = 0.5;