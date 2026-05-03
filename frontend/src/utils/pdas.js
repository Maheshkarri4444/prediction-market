import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../constants";

export const getMarketplacePda = () =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("predictionmarketplace_v1")],
    PROGRAM_ID
  );

export const getDaoPda = () =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao")],
    PROGRAM_ID
  );

export const getUserPda = (userPublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("user_v1"), userPublicKey.toBuffer()],
    PROGRAM_ID
  );

export const getDaoUserPda = (userPublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("dao_user"), userPublicKey.toBuffer()],
    PROGRAM_ID
  );