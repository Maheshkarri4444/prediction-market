import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import fs from "fs";
import BN from "bn.js";
import { PredictionMarket } from "../target/types/prediction_market";
import { parsePriceData } from "@pythnetwork/client";
describe("prediction-market-full", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const connection = provider.connection;
  const program = anchor.workspace
    .PredictionMarket as Program<PredictionMarket>;

  const creator = provider.wallet;

  let marketplacePda: PublicKey;
  let marketplaceVault: PublicKey;

  let daoPda: PublicKey;
  let daoVault: PublicKey;
  let daoStakeAccount: PublicKey;


  // -----------------------------------
  // INIT MARKETPLACE
  // -----------------------------------
  it("Initialize Prediction Marketplace", async () => {
    [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("predictionmarketplace_v1")],
      program.programId
    );

    [marketplaceVault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("predictionmarketplace_vault"),
        marketplacePda.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .initializePredictionMarket()
      .accounts({
        creator: creator.publicKey,
        predictionMarketPlace: marketplacePda,
        predictionMarketPlaceVault: marketplaceVault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const acc =
      await program.account.predictionMarketPlaceDetails.fetch(
        marketplacePda
      );

    assert.ok(acc.creator.equals(creator.publicKey));
  });

    it("Initialize DAO", async () => {
    [daoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("prediction_market_dao")],
      program.programId
    );


    [daoVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("prediction_market_dao_vault")],
      program.programId
    );

    [daoStakeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao_stake_account")], 
      program.programId
    );

    await program.methods
      .initializeDao()
      .accounts({
        creator: creator.publicKey,
        predictionMarketPlace: marketplacePda,
        dao: daoPda,
        daoVault: daoVault,
        daoStakeAccount: daoStakeAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const daoAcc = await program.account.dao.fetch(daoPda);
    assert.ok(daoAcc.creator.equals(creator.publicKey));
  });
});