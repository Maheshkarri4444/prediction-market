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

export const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1YWY3NTExMC0zZDY5LTRhMjEtYmUwMi00YzY2Y2Y3NGIzNDAiLCJlbWFpbCI6Im1haGVzaGthcnJpMjIyMkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiODVhNjNhMmVkNTdmYWQxMTRkZjMiLCJzY29wZWRLZXlTZWNyZXQiOiI5YjU3MTJiN2I1YTlkM2RlYzEyZWQxNjNiYTkyYTMxMGQwM2JkNmZmODAyMGZhZGRjMmQxMDBkNzdhYWJlMTU1IiwiZXhwIjoxODA5MzU4OTk5fQ.Hln2FToIbDYV2TAvVrlwy7YQKjVXkxal8Uf8BLE2Oa8";