// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
// import { assert } from "chai";
// import fs from "fs";
// import BN from "bn.js";
// import { PredictionMarket } from "../target/types/prediction_market";
// import { parsePriceData } from "@pythnetwork/client";
// describe("prediction-market-full", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const connection = provider.connection;
//   const program = anchor.workspace
//     .PredictionMarket as Program<PredictionMarket>;

//   const creator = provider.wallet;

//   const rawKeys = JSON.parse(fs.readFileSync("keys.json", "utf-8"));
//   const user1 = Keypair.fromSecretKey(Uint8Array.from(rawKeys[0].secretKey));
//   const user2 = Keypair.fromSecretKey(Uint8Array.from(rawKeys[1].secretKey));

//   const PYTH_ETH_FEED = new PublicKey(
//     "EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"
//   );

//   let marketplacePda: PublicKey;
//   let marketplaceVault: PublicKey;

//   let user1Pda: PublicKey;
//   let user2Pda: PublicKey;
//   let creatorPda: PublicKey;

//   let marketPda: PublicKey;
//   let marketVault: PublicKey;

//   let optionMint1: Keypair;
//   let optionMint2: Keypair;

//   let orderPda: PublicKey;
//   let tokenAccount: PublicKey;

//   // -----------------------------------
//   // INIT MARKETPLACE
//   // -----------------------------------
//   it("Initialize Prediction Marketplace", async () => {
//     [marketplacePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("predictionmarketplace_v1")],
//       program.programId
//     );

//     [marketplaceVault] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("predictionmarketplace_vault"),
//         marketplacePda.toBuffer(),
//       ],
//       program.programId
//     );

//     // await program.methods
//     //   .initializePredictionMarket()
//     //   .accounts({
//     //     creator: creator.publicKey,
//     //     predictionMarketPlace: marketplacePda,
//     //     predictionMarketPlaceVault: marketplaceVault,
//     //     systemProgram: SystemProgram.programId,
//     //   })
//     //   .rpc();

//     const acc =
//       await program.account.predictionMarketPlaceDetails.fetch(
//         marketplacePda
//       );

//     assert.ok(acc.creator.equals(creator.publicKey));
//   });

//   // -----------------------------------
//   // CREATE USERS
//   // -----------------------------------
//   it("Create Users", async () => {
//     [user1Pda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("user_v1"), user1.publicKey.toBuffer()],
//       program.programId
//     );

//     [user2Pda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("user_v1"), user2.publicKey.toBuffer()],
//       program.programId
//     );

//     [creatorPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("user_v1"), creator.publicKey.toBuffer()],
//       program.programId
//     );

//     // await program.methods
//     //   .createUser("user1")
//     //   .accounts({
//     //     user: user1.publicKey,
//     //     userAccount: user1Pda,
//     //     systemProgram: SystemProgram.programId,
//     //   })
//     //   .signers([user1])
//     //   .rpc();

//     // await program.methods
//     //   .createUser("user2")
//     //   .accounts({
//     //     user: user2.publicKey,
//     //     userAccount: user2Pda,
//     //     systemProgram: SystemProgram.programId,
//     //   })
//     //   .signers([user2])
//     //   .rpc();

//     // await program.methods
//     //   .createUser("creator")
//     //   .accounts({
//     //     user: creator.publicKey,
//     //     userAccount: creatorPda,
//     //     systemProgram: SystemProgram.programId,
//     //   })
//     //   .rpc();
//   });

//   it("Fetch Price Feed", async () => {
//     const accountInfo = await provider.connection.getAccountInfo(PYTH_ETH_FEED);

//     if (!accountInfo) throw new Error("No account info");

//     const priceData = parsePriceData(accountInfo.data);

//     console.log("ETH price:", priceData.price);
//     console.log("Confidence:", priceData.confidence);
//     console.log("Expo:", priceData.exponent);
//   });

//   // -----------------------------------
//   // CREATE MARKET
//   // -----------------------------------
//   it("Create Market", async () => {
//     const marketplace =
//       await program.account.predictionMarketPlaceDetails.fetch(
//         marketplacePda
//       );

//     const marketId = marketplace.totalMarkets.add(new BN(1));

//     [marketPda] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("market"),
//         creator.publicKey.toBuffer(),
//         marketId.toArrayLike(Buffer, "le", 8),
//       ],
//       program.programId
//     );

//     [marketVault] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("market_vault"),
//         creator.publicKey.toBuffer(),
//         marketPda.toBuffer(),
//       ],
//       program.programId
//     );

//     const now = Math.floor(Date.now() / 1000);

//     await program.methods
//       .createMarket(
//         {
//           greaterThanAtTime: {
//             priceFeed: PYTH_ETH_FEED,
//             targetPrice: new BN(1000),
//             time: new BN(now + 60),
//           },
//         },
//         "Will ETH > 1000?",
//         new BN(now + 30)
//       )
//       .accounts({
//         creator: creator.publicKey,
//         user: creatorPda,
//         predictionMarketPlace: marketplacePda,
//         predictionMarketVault: marketplaceVault,
//         market: marketPda,
//         marketVault: marketVault,
//         priceFeed: PYTH_ETH_FEED,
//         systemProgram: SystemProgram.programId,
//       })
//       .rpc();
//   });

//   // -----------------------------------
//   // ADD OPTIONS
//   // -----------------------------------
//   it("Add Options", async () => {
//     optionMint1 = Keypair.generate();
//     optionMint2 = Keypair.generate();

//     await program.methods
//       .addOptionDetails()
//       .accounts({
//         creator: creator.publicKey,
//         market: marketPda,
//         tokenMint: optionMint1.publicKey,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       })
//       .signers([optionMint1])
//       .rpc();

//     await program.methods
//       .addOptionDetails()
//       .accounts({
//         creator: creator.publicKey,
//         market: marketPda,
//         tokenMint: optionMint2.publicKey,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       })
//       .signers([optionMint2])
//       .rpc();
//   });

//   // -----------------------------------
//   // CREATE ORDER
//   // -----------------------------------
//   it("Create Order", async () => {
//     const [user1Pda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("user_v1"), user1.publicKey.toBuffer()],
//         program.programId
//       );
//     console.log("User1 wallet:", user1.publicKey.toBase58());
//     console.log("User2 wallet:", user2.publicKey.toBase58());
//     const userAcc = await program.account.user.fetch(user1Pda);

//     const orderId = userAcc.totalOrders.add(new BN(1));

//     [orderPda] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("buy_shares"),
//         user1.publicKey.toBuffer(),
//         marketPda.toBuffer(),
//         orderId.toArrayLike(Buffer, "be", 8),
//       ],
//       program.programId
//     );

//     tokenAccount = await anchor.utils.token.associatedAddress({
//       mint: optionMint2.publicKey,
//       owner: user1.publicKey,
//     });

//     await program.methods
//       .createOrder(1, new anchor.BN(1_000_000))
//       .accounts({
//         buyer: user1.publicKey,
//         user: user1Pda,
//         market: marketPda,
//         tokenMint: optionMint2.publicKey,
//         order: orderPda,
//         marketVault: marketVault,
//         tokenAccount: tokenAccount,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         associatedTokenProgram:
//           anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//       })
//       .signers([user1])
//       .rpc();

//     const updatedMarket = await program.account.market.fetch(marketPda);

//     console.log("Opiton data: ", updatedMarket.options[1]);

//       console.log(
//         "Updated pool:",
//         updatedMarket.options[1].poolAmount.toString()
//       );

//       if (updatedMarket.options[1].poolAmount.toNumber() === 0) {
//         throw new Error("Order failed");
//       }
//   });

//   // -----------------------------------
//   // WAIT + RESOLVE MARKET
//   // -----------------------------------
//   it("Resolve Market", async () => {
//     console.log("Waiting for market end...");
//     await new Promise((r) => setTimeout(r, 65000));

//     await program.methods
//       .resolveMarket()
//       .accounts({
//         resolver: creator.publicKey,
//         market: marketPda,
//         priceFeed: PYTH_ETH_FEED,
//         predictionMarketplace: marketplacePda,
//         predictionMarketplaceVault: marketplaceVault,
//         systemProgram: SystemProgram.programId,
//       })
//       .rpc();

//     const market = await program.account.market.fetch(marketPda);
//     assert.ok(market.resolved === true);
//   });

//   // // -----------------------------------
//   // // CLAIM REWARD
//   // // -----------------------------------
//   it("Claim Reward", async () => {
//     const beforeBalance = await provider.connection.getBalance(
//       user1.publicKey
//     );
//     await program.methods
//       .claimWinningReward()
//       .accounts({
//         user: user1.publicKey,
//         userAccount: user1Pda,
//         market: marketPda,
//         marketVault: marketVault,
//         tokenMint: optionMint2.publicKey,
//         tokenAccount: tokenAccount,
//         systemProgram: SystemProgram.programId,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         associatedTokenProgram:
//           anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//       })
//       .signers([user1])
//       .rpc();

//     const afterBalance = await provider.connection.getBalance(
//         user1.publicKey
//     );

//     console.log("Before:", beforeBalance);
//     console.log("After :", afterBalance);

//   });

//   // claim funds 
//   it("Claim Funds", async () => {
//     const beforeBalance = await provider.connection.getBalance(
//       creator.publicKey
//     );

//     await program.methods
//       .claimFunds()
//       .accounts({
//         creator: creator.publicKey,
//         predictionMarketPlace: marketplacePda,
//         predictionMarketPlaceVault: marketplaceVault,
//       })
//       .rpc();

//     const afterBalance = await provider.connection.getBalance(
//       creator.publicKey
//     );

//     console.log("Before:", beforeBalance);
//     console.log("After :", afterBalance);

//     // just basic sanity check
//     assert.ok(afterBalance >= beforeBalance);
//   });

// });