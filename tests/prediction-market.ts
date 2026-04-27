import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";
import * as fs from "fs";

const rawKeys = JSON.parse(fs.readFileSync("keys.json", "utf-8"));

describe("prediction-market-devnet", () => {
  // 👇 DEVNET provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const connection = provider.connection;
  const program = anchor.workspace
    .PredictionMarket as Program<PredictionMarket>;

  const creator = provider.wallet;

  const user1 = Keypair.fromSecretKey(Uint8Array.from(rawKeys[0].secretKey));
  const user2 = Keypair.fromSecretKey(Uint8Array.from(rawKeys[1].secretKey));

  let marketplacePda: PublicKey;
  let marketplaceVault: PublicKey;

  let marketPda: PublicKey;
  let yesMint: Keypair;
  let noMint: Keypair;
  let yesVault: PublicKey;
  let noVault: PublicKey;

  let user1Pda: PublicKey;
  let user2Pda: PublicKey;

  // 🔥 REAL PYTH ETH PRICE FEED (DEVNET)
  const PYTH_ETH_FEED = new PublicKey(
    "J83w4HKfqxwcq3t4eLQ7nZ8b8s8f1L9E4yF4gq5K6v8y"
  );

  // --------------------------------------------------
  // 1. Initialize Prediction Marketplace
  // --------------------------------------------------
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

    // await program.methods
    //   .initializePredictionMarket()
    //   .accounts({
    //     creator: creator.publicKey,
    //     predictionMarketPlace: marketplacePda,
    //     predictionMarketPlaceVault: marketplaceVault,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();

    const acc =
      await program.account.predictionMarketPlaceDetails.fetch(
        marketplacePda
      );

    assert.ok(acc.creator.equals(creator.publicKey));
  });

  // --------------------------------------------------
  // 3. Create Users
  // --------------------------------------------------
  it("Create Users", async () => {
    [user1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_v1"), user1.publicKey.toBuffer()],
      program.programId
    );

    [user2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_v1"), user2.publicKey.toBuffer()],
      program.programId
    );

    // await program.methods
    //   .createUser("user1")
    //   .accounts({
    //     user: user1.publicKey,
    //     userAccount: user1Pda,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .signers([user1])
    //   .rpc();

    // await program.methods
    //   .createUser("user2")
    //   .accounts({
    //     user: user2.publicKey,
    //     userAccount: user2Pda,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .signers([user2])
    //   .rpc();
  });

  // --------------------------------------------------
  // 4. Create Market
  // --------------------------------------------------
  it("Create Market (ETH > price)", async () => {
    const marketplace =
      await program.account.predictionMarketPlaceDetails.fetch(marketplacePda);

    const marketId = new anchor.BN(
      marketplace.totalMarkets.toNumber() + 1
    );

    [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        creator.publicKey.toBuffer(),
        marketId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    yesMint = Keypair.generate();
    noMint = Keypair.generate();

    [yesVault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("yes_token_vault"),
        marketPda.toBuffer(),
        yesMint.publicKey.toBuffer(),
      ],
      program.programId
    );

    [noVault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("no_token_vault"),
        marketPda.toBuffer(),
        noMint.publicKey.toBuffer(),
      ],
      program.programId
    );

    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createMarket(
        {
          greaterThanAtTime: {
            priceFeed: PYTH_ETH_FEED,
            targetPrice: new anchor.BN(2000),
            time: new anchor.BN(now + 120),
          },
        },
        "ETH > 2000?",
        new anchor.BN(now + 60)
      )
      .accounts({
        creator: creator.publicKey,
        predictionMarketPlace: marketplacePda,
        predictionMarketVault: marketplaceVault,
        market: marketPda,
        yesTokenMint: yesMint.publicKey,
        noTokenMint: noMint.publicKey,
        yesTokenVault: yesVault,
        noTokenVault: noVault,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([yesMint, noMint])
      .rpc();
  });

  // --------------------------------------------------
  // 5. Place Orders
  // --------------------------------------------------
  it("Place Orders", async () => {
    const qty = new anchor.BN(10);

    const userAccount = await program.account.user.fetch(user1Pda);

    const orderIndex = userAccount.totalOrders.add(new anchor.BN(1));

    console.log("Placing order with index: ", orderIndex.toString());

    const [orderPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("buy_shares"),
        marketPda.toBuffer(),
        orderIndex.toArrayLike(Buffer, "be", 8),
      ],
      program.programId
    );


    await program.methods
      .createOrder({ yes: {} }, qty)
      .accounts({
        buyer: user1.publicKey,
        user: user1Pda,
        market: marketPda,
        yesTokenMint: yesMint.publicKey,
        noTokenMint: noMint.publicKey,
        order: orderPda,
        yesPoolVault: yesVault,
        noPoolVault: noVault,
        yesTokenAccount: anchor.utils.token.associatedAddress({
          mint: yesMint.publicKey,
          owner: user1.publicKey,
        }),
        noTokenAccount: anchor.utils.token.associatedAddress({
          mint: noMint.publicKey,
          owner: user1.publicKey,
        }),
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user1])
      .rpc();
  });

  // --------------------------------------------------
  // 6. Resolve Market
  // --------------------------------------------------
  // it("Resolve Market", async () => {
  //   console.log("Waiting for market end...");
  //   await new Promise((r) => setTimeout(r, 65000));

  //   await program.methods
  //     .resolveMarket()
  //     .accounts({
  //       resolver: creator.publicKey,
  //       market: marketPda,
  //       priceFeed: PYTH_ETH_FEED,
  //       predictionMarketplace: marketplacePda,
  //       predictionMarketplaceVault: marketplaceVault,
  //     })
  //     .rpc();

  //   const market = await program.account.market.fetch(marketPda);
  //   assert.equal(market.resolved, true);
  // });

  // // --------------------------------------------------
  // // 7. Claim Reward
  // // --------------------------------------------------
  // it("Claim Reward", async () => {
  //   await program.methods
  //     .claimWinningReward()
  //     .accounts({
  //       user: user1.publicKey,
  //       market: marketPda,
  //       yesTokenMint: yesMint.publicKey,
  //       noTokenMint: noMint.publicKey,
  //       yesPoolVault: yesVault,
  //       noPoolVault: noVault,
  //       yesTokenAccount: anchor.utils.token.associatedAddress({
  //         mint: yesMint.publicKey,
  //         owner: user1.publicKey,
  //       }),
  //       noTokenAccount: anchor.utils.token.associatedAddress({
  //         mint: noMint.publicKey,
  //         owner: user1.publicKey,
  //       }),
  //       systemProgram: SystemProgram.programId,
  //       tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //     })
  //     .signers([user1])
  //     .rpc();
  // });

  // // --------------------------------------------------
  // // 8. Creator Claim Treasury
  // // --------------------------------------------------
  // it("Claim Treasury", async () => {
  //   await program.methods
  //     .claimFunds()
  //     .accounts({
  //       creator: creator.publicKey,
  //       predictionMarketPlace: marketplacePda,
  //       predictionMarketPlaceVault: marketplaceVault,
  //     })
  //     .rpc();
  // });
});