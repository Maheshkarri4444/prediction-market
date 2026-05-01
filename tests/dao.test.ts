import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { assert } from "chai";
import fs from "fs";

describe("dao-full", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program;

  const creator = provider.wallet;

  // -------------------------------
  // LOAD DAO WALLETS
  // -------------------------------
  const raw = JSON.parse(fs.readFileSync("dao_wallets.json", "utf-8"));

  const daoUser1 = Keypair.fromSecretKey(Uint8Array.from(raw[0].secretKey));
  const daoUser2 = Keypair.fromSecretKey(Uint8Array.from(raw[1].secretKey));
  const daoUser3 = Keypair.fromSecretKey(Uint8Array.from(raw[2].secretKey));

  const metadataProgramId = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  let marketplacePda: PublicKey;

  let daoPda: PublicKey;
  let daoVault: PublicKey;
  let daoStakeAccount: PublicKey;

  // DAO USER PDAs
  let daoUser1Pda: PublicKey;
  let daoUser2Pda: PublicKey;
  let daoUser3Pda: PublicKey;

  let daoUserStake1: PublicKey;
  let daoUserStake2: PublicKey;
  let daoUserStake3: PublicKey;

  // NFT mint + ATA + metadata
  let mint1 = Keypair.generate();
  let mint2 = Keypair.generate();
  let mint3 = Keypair.generate();

  let metadata1: PublicKey;
  let metadata2: PublicKey;
  let metadata3: PublicKey;

  let ata1: PublicKey;
  let ata2: PublicKey;
  let ata3: PublicKey;

  // -----------------------------------
  // FETCH MARKETPLACE
  // -----------------------------------
  it("Fetch Marketplace", async () => {
    [marketplacePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("predictionmarketplace_v1")],
      program.programId
    );

    const acc =
      await program.account.predictionMarketPlaceDetails.fetch(
        marketplacePda
      );

    assert.ok(acc.creator.equals(creator.publicKey));
  });

  // -----------------------------------
  // INITIALIZE DAO
  // -----------------------------------
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

    // await program.methods
    //   .initializeDao()
    //   .accounts({
    //     creator: creator.publicKey,
    //     predictionMarketPlace: marketplacePda,
    //     dao: daoPda,
    //     daoVault: daoVault,
    //     daoStakeAccount: daoStakeAccount,
    //     systemProgram: SystemProgram.programId,
    //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //   })
    //   .rpc();

    const daoAcc = await program.account.dao.fetch(daoPda);
    assert.ok(daoAcc.creator.equals(creator.publicKey));
  });

  // -----------------------------------
  // CREATE DAO USER (helper)
  // -----------------------------------
  const createDaoUser = async (
    user: Keypair,
    mint: Keypair
  ) => {
    const [daoUserPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao_user"), user.publicKey.toBuffer()],
      program.programId
    );

    const [stakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao_user_stake_account"), user.publicKey.toBuffer()],
      program.programId
    );

    const ata = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: user.publicKey,
    });

    const [metadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        metadataProgramId.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      metadataProgramId
    );

    await program.methods
      .createDaoUser(
        "dao_user",
        "DAO",
        "https://example.com/meta.json"
      )
      .accounts({
        user: user.publicKey,
        dao: daoPda,
        daoVault: daoVault,
        daoUser: daoUserPda,
        daoUserStakeAccount: stakePda,
        daoNftMint: mint.publicKey,
        userNftAccount: ata,
        metadata: metadata,
        metadataProgram: metadataProgramId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram:
          anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user, mint])
      .rpc();

    return { daoUserPda, stakePda, ata, metadata };
  };

  // -----------------------------------
  // CREATE 3 DAO USERS
  // -----------------------------------
  it("Create DAO Users", async () => {
    const u1 = await createDaoUser(daoUser1, mint1);
    const u2 = await createDaoUser(daoUser2, mint2);
    const u3 = await createDaoUser(daoUser3, mint3);

    daoUser1Pda = u1.daoUserPda;
    daoUser2Pda = u2.daoUserPda;
    daoUser3Pda = u3.daoUserPda;

    console.log("DAO Users created ✅");
  });
});