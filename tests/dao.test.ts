// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import {
//   PublicKey,
//   SystemProgram,
//   Keypair,
//   SYSVAR_RENT_PUBKEY,
// } from "@solana/web3.js";
// import { assert } from "chai";
// import fs from "fs";
// import BN from "bn.js";

// describe("dao-full", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace.PredictionMarket as Program;

//   const creator = provider.wallet;

//     const rawKeys = JSON.parse(fs.readFileSync("keys.json", "utf-8"));
//   const user1 = Keypair.fromSecretKey(Uint8Array.from(rawKeys[0].secretKey));
//   const user2 = Keypair.fromSecretKey(Uint8Array.from(rawKeys[1].secretKey));

//   // -------------------------------
//   // LOAD DAO WALLETS
//   // -------------------------------
//   const raw = JSON.parse(fs.readFileSync("dao_wallets.json", "utf-8"));

//   const daoUser1 = Keypair.fromSecretKey(Uint8Array.from(raw[0].secretKey));
//   const daoUser2 = Keypair.fromSecretKey(Uint8Array.from(raw[1].secretKey));
//   const daoUser3 = Keypair.fromSecretKey(Uint8Array.from(raw[2].secretKey));

//   const metadataProgramId = new PublicKey(
//     "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
//   );

//   let marketplacePda: PublicKey;


//   let daoPda: PublicKey;
//   let daoVault: PublicKey;
//   let daoStakeAccount: PublicKey;

//   // DAO USER PDAs
//   let daoUser1Pda: PublicKey;
//   let daoUser2Pda: PublicKey;
//   let daoUser3Pda: PublicKey;

//   let daoUserStake1: PublicKey;
//   let daoUserStake2: PublicKey;
//   let daoUserStake3: PublicKey;

//   // NFT mint + ATA + metadata
//   let mint1 = Keypair.generate();
//   let mint2 = Keypair.generate();
//   let mint3 = Keypair.generate();

//   let metadata1: PublicKey;
//   let metadata2: PublicKey;
//   let metadata3: PublicKey;

//   let ata1: PublicKey;
//   let ata2: PublicKey;
//   let ata3: PublicKey;

//   let creatorPda: PublicKey;

//   let eventMarketPda: PublicKey;
//   let eventMarketVault: PublicKey;

//   let eventMint1 = Keypair.generate();
//   let eventMint2 = Keypair.generate();

//   // -----------------------------------
//   // FETCH MARKETPLACE
//   // -----------------------------------
//   it("Fetch Marketplace", async () => {
//     [marketplacePda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("predictionmarketplace_v1")],
//       program.programId
//     );

//     const acc =
//       await program.account.predictionMarketPlaceDetails.fetch(
//         marketplacePda
//       );

//     assert.ok(acc.creator.equals(creator.publicKey));
//   });

//   // -----------------------------------
//   // INITIALIZE DAO
//   // -----------------------------------
//   it("Initialize DAO", async () => {
//     [daoPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("prediction_market_dao")],
//       program.programId
//     );

//     [creatorPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("user_v1"), creator.publicKey.toBuffer()],
//       program.programId
//     );

//     [daoVault] = PublicKey.findProgramAddressSync(
//       [Buffer.from("prediction_market_dao_vault")],
//       program.programId
//     );

//     [daoStakeAccount] = PublicKey.findProgramAddressSync(
//       [Buffer.from("dao_stake_account")], 
//       program.programId
//     );

//     // await program.methods
//     //   .initializeDao()
//     //   .accounts({
//     //     creator: creator.publicKey,
//     //     predictionMarketPlace: marketplacePda,
//     //     dao: daoPda,
//     //     daoVault: daoVault,
//     //     daoStakeAccount: daoStakeAccount,
//     //     systemProgram: SystemProgram.programId,
//     //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//     //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//     //   })
//     //   .rpc();

//     const daoAcc = await program.account.dao.fetch(daoPda);
//     assert.ok(daoAcc.creator.equals(creator.publicKey));
//   });

//   // -----------------------------------
//   // CREATE DAO USER (helper)
//   // -----------------------------------
//   const createDaoUser = async (
//     user: Keypair,
//     mint: Keypair
//   ) => {
//     const [daoUserPda] = PublicKey.findProgramAddressSync(
//       [Buffer.from("dao_user"), user.publicKey.toBuffer()],
//       program.programId
//     );

//     const ata = await anchor.utils.token.associatedAddress({
//       mint: mint.publicKey,
//       owner: user.publicKey,
//     });

//     const [metadata] = PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("metadata"),
//         metadataProgramId.toBuffer(),
//         mint.publicKey.toBuffer(),
//       ],
//       metadataProgramId
//     );

//     // await program.methods
//     //   .createDaoUser(
//     //     "dao_user",
//     //     "DAO",
//     //     "https://example.com/meta.json"
//     //   )
//     //   .accounts({
//     //     user: user.publicKey,
//     //     dao: daoPda,
//     //     daoVault: daoVault,
//     //     daoUser: daoUserPda,
//     //     daoNftMint: mint.publicKey,
//     //     userNftAccount: ata,
//     //     metadata: metadata,
//     //     metadataProgram: metadataProgramId,
//     //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//     //     systemProgram: SystemProgram.programId,
//     //     associatedTokenProgram:
//     //       anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//     //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//     //   })
//     //   .signers([user, mint])
//     //   .rpc();

//     return { daoUserPda, ata, metadata };
//   };

//   // -----------------------------------
//   // CREATE 3 DAO USERS
//   // -----------------------------------
//   it("Create DAO Users", async () => {
//     const u1 = await createDaoUser(daoUser1, mint1);
//     const u2 = await createDaoUser(daoUser2, mint2);
//     const u3 = await createDaoUser(daoUser3, mint3);

//     daoUser1Pda = u1.daoUserPda;
//     daoUser2Pda = u2.daoUserPda;
//     daoUser3Pda = u3.daoUserPda;

//     console.log("DAO Users created ✅");
//   });

//     const stakeDaoUser = async (user: Keypair, daoUserPda: PublicKey) => {
//     const amount = new BN(500_000_000); // 0.5 SOL

//     // await program.methods
//     //     .stake(amount)
//     //     .accounts({
//     //     user: user.publicKey,
//     //     daoUser: daoUserPda,
//     //     dao: daoPda,
//     //     daoStakeAccount: daoStakeAccount,
//     //     systemProgram: SystemProgram.programId,
//     //     })
//     //     .signers([user])
//     //     .rpc();

//     return amount;
//     };

//     const unstakeDaoUser = async (user: Keypair, daoUserPda: PublicKey) => {
//     const amount = new BN(500_000_000); // 0.5 SOL

//     // await program.methods
//     //     .unstake(amount)
//     //     .accounts({
//     //     user: user.publicKey,
//     //     daoUser: daoUserPda,
//     //     dao: daoPda,
//     //     daoStakeAccount: daoStakeAccount,
//     //     systemProgram: SystemProgram.programId,
//     //     })
//     //     .signers([user])
//     //     .rpc();

//     return amount;
//     };

//     it("Stake in DAO", async () => { 
//         await stakeDaoUser(daoUser1, daoUser1Pda);
//         await stakeDaoUser(daoUser2, daoUser2Pda);
//         await stakeDaoUser(daoUser3, daoUser3Pda);

//         const u3 = await program.account.daoUser.fetch(daoUser3Pda);

//         console.log("User3 stake:", u3.freeAmount.toString());

//         assert.ok(u3.totalStake.toNumber() > 0);
//     });

//     it("Unstake DAO Users", async () => {
//         await unstakeDaoUser(daoUser3, daoUser3Pda);

//         const u1 = await program.account.daoUser.fetch(daoUser1Pda);

//         console.log("User1 free amount:", u1.freeAmount.toString());

//         assert.ok(u1.freeAmount.toNumber() >= 0);
//     });

//     it("Debug DAO Stakes + Quorum", async () => {
//       // 🔹 DAO
//       const dao = await program.account.dao.fetch(daoPda);

//       console.log("=== DAO ===");
//       console.log("Total DAO Stake:", dao.daoTotalStake.toString());

//       const quorum = dao.daoTotalStake.div(new BN(10));
//       console.log("Required Quorum (10%):", quorum.toString());

//       // 🔹 DAO USERS
//       const daoUsers = [daoUser1, daoUser2, daoUser3];

//       let totalUserStake = new BN(0);

//       console.log("\n=== DAO USERS ===");

//       for (const user of daoUsers) {
//         const [daoUserPda] = PublicKey.findProgramAddressSync(
//           [Buffer.from("dao_user"), user.publicKey.toBuffer()],
//           program.programId
//         );

//         const daoUserAcc = await program.account.daoUser.fetch(daoUserPda);

//         console.log(`\nUser: ${user.publicKey.toBase58()}`);
//         console.log("  Total Stake :", daoUserAcc.totalStake.toString());
//         console.log("  Free Amount :", daoUserAcc.freeAmount.toString());
//         console.log("  Locked Amt  :", daoUserAcc.lockedAmount.toString());

//         totalUserStake = totalUserStake.add(daoUserAcc.totalStake);
//       }

//       console.log("\nSum of user stakes:", totalUserStake.toString());


//     });

//     // -----------------------------------
//     // CREATE EVENT MARKET
//     // -----------------------------------
//     it("Create Event Market", async () => {
//     const marketplace =
//         await program.account.predictionMarketPlaceDetails.fetch(
//         marketplacePda
//         );

//     const marketId = marketplace.totalMarkets.add(new BN(1));

//     [eventMarketPda] = PublicKey.findProgramAddressSync(
//         [
//         Buffer.from("event_market"),
//         creator.publicKey.toBuffer(),
//         marketId.toArrayLike(Buffer, "le", 8),
//         ],
//         program.programId
//     );

//     [eventMarketVault] = PublicKey.findProgramAddressSync(
//         [
//         Buffer.from("event_market_vault"),
//         creator.publicKey.toBuffer(),
//         eventMarketPda.toBuffer(),
//         ],
//         program.programId
//     );
    
//     const now = Math.floor(Date.now() / 1000);

//     await program.methods
//         .createEventMarket(
//         {
//             optioned: {
//             options: [
//                 { optionName: "YES" },
//                 { optionName: "NO" },
//             ],
//             },
//         },
//         "Will RCB win today's match?",
//         new BN(now + 30),
//         new BN(now + 40)
//         )
//         .accounts({
//         creator: creator.publicKey,
//         user: creatorPda,
//         predictionMarketPlace: marketplacePda,
//         market: eventMarketPda,
//         marketVault: eventMarketVault,
//         dao: daoPda,
//         daoVault: daoVault,
//         systemProgram: SystemProgram.programId,
//         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//         })
//         .rpc();

//     const market = await program.account.eventMarket.fetch(eventMarketPda);

//     console.log("Event Market Created:", market.question);

//     const acc = await provider.connection.getAccountInfo(eventMarketVault);
//     console.log("Vault data length:", acc.data.length);

//     if (!market.question.includes("RCB")) {
//         throw new Error("Market not created properly");
//     }
//     });

//     // -----------------------------------
//     // ADD EVENT OPTIONS
//     // -----------------------------------
//     it("Add Event Options", async () => {
//     await program.methods
//         .addOptionForEventMarket()
//         .accounts({
//         creator: creator.publicKey,
//         market: eventMarketPda,
//         tokenMint: eventMint1.publicKey,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//         })
//         .signers([eventMint1])
//         .rpc();

//     await program.methods
//         .addOptionForEventMarket()
//         .accounts({
//         creator: creator.publicKey,
//         market: eventMarketPda,
//         tokenMint: eventMint2.publicKey,
//         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//         systemProgram: SystemProgram.programId,
//         })
//         .signers([eventMint2])
//         .rpc();

//     const market = await program.account.eventMarket.fetch(eventMarketPda);

//     console.log("Options added:", market.options.length);

//     if (market.options.length !== 2) {
//         throw new Error("Options not added properly");
//     }

//     if (!market.started) {
//         throw new Error("Market should be started after options added");
//     }
//     });

//     // -----------------------------------
//     // CREATE ORDER (NORMAL USER)
//     // -----------------------------------
//     it("Create Event Order (User1)", async () => {
//       const market = await program.account.eventMarket.fetch(eventMarketPda);

//       const optionMint = market.options[0].mint;

//       const [user1Pda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("user_v1"), user1.publicKey.toBuffer()],
//         program.programId
//       );

//       const userAcc = await program.account.user.fetch(user1Pda);

//       const orderId = userAcc.totalOrders.add(new BN(1));

//       const [orderPda] = PublicKey.findProgramAddressSync(
//         [
//           Buffer.from("buy_shares"),
//           user1.publicKey.toBuffer(), 
//           eventMarketPda.toBuffer(),
//           orderId.toArrayLike(Buffer, "be", 8),
//         ],
//         program.programId
//       );

//       const user1OptionATA = await anchor.utils.token.associatedAddress({
//         mint: optionMint,
//         owner: user1.publicKey,
//       });

//       const quantity = new BN(1_000_000);

//       await program.methods
//         .createEventOrder(0, quantity)
//         .accounts({
//           buyer: user1.publicKey,
//           user: user1Pda,                
//           market: eventMarketPda,
//           tokenMint: optionMint,
//           order: orderPda,               
//           marketVault: eventMarketVault,
//           tokenAccount: user1OptionATA,
//           tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//           associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//           systemProgram: SystemProgram.programId,
//           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//         })
//         .signers([user1])
//         .rpc();

//       console.log("Order placed by user1 ✅");

//       const updatedMarket = await program.account.eventMarket.fetch(eventMarketPda);

//       console.log(
//         "Updated pool:",
//         updatedMarket.options[0].poolAmount.toString()
//       );

//       if (updatedMarket.options[0].poolAmount.toNumber() === 0) {
//         throw new Error("Order failed");
//       }
//     });

//     it("Create Event Order (User2)", async () => {
//       const market = await program.account.eventMarket.fetch(eventMarketPda);

//       const optionMint = market.options[1].mint; // user2 chooses YES

//       const [user2Pda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("user_v1"), user2.publicKey.toBuffer()],
//         program.programId
//       );

//       const userAcc = await program.account.user.fetch(user2Pda);

//       const orderId = userAcc.totalOrders.add(new BN(1));

//       const [orderPda] = PublicKey.findProgramAddressSync(
//         [
//           Buffer.from("buy_shares"),
//           user2.publicKey.toBuffer(), 
//           eventMarketPda.toBuffer(),
//           orderId.toArrayLike(Buffer, "be", 8),
//         ],
//         program.programId
//       );

//       const user2OptionATA = await anchor.utils.token.associatedAddress({
//         mint: optionMint,
//         owner: user2.publicKey,
//       });

//       const quantity = new BN(1_000_000);

//       await program.methods
//         .createEventOrder(1, quantity)
//         .accounts({
//           buyer: user2.publicKey,
//           user: user2Pda,
//           market: eventMarketPda,
//           tokenMint: optionMint,
//           order: orderPda,
//           marketVault: eventMarketVault,
//           tokenAccount: user2OptionATA,
//           tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//           associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//           systemProgram: SystemProgram.programId,
//           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//         })
//         .signers([user2])
//         .rpc();

//       const vault_balance = await provider.connection.getBalance(eventMarketVault);
//       console.log("Vault balance after user2 order:", vault_balance);

//       console.log("Order placed by user2 ✅");
//     });

//     it("Wait for event to end", async () => {
//       console.log("Waiting for event_end_time...");

//       await new Promise((resolve) => setTimeout(resolve, 45000)); 

//       console.log("Event ended ✅");
//     });


//     // vote logic
//     const vote = async (
//       user: Keypair,
//       option: number,
//       stake: number
//     ) => {
//       const [votePda] = PublicKey.findProgramAddressSync(
//         [
//           Buffer.from("vote"),
//           user.publicKey.toBuffer(),
//           eventMarketPda.toBuffer(),
//         ],
//         program.programId
//       );

//       const [daoUserPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("dao_user"), user.publicKey.toBuffer()],
//         program.programId
//       );

//       await program.methods
//         .voteOnMarket(option, new BN(stake))
//         .accounts({
//           voter: user.publicKey,
//           dao: daoPda,
//           daoUser: daoUserPda,
//           market: eventMarketPda,
//           vote: votePda,
//           systemProgram: SystemProgram.programId,
//           rent: SYSVAR_RENT_PUBKEY,
//         })
//         .signers([user])
//         .rpc();

//       console.log(
//         `Vote done → ${user.publicKey.toBase58()} | option=${option} | stake=${stake}`
//       );
//     };

//     it("DAO Voting (loop)", async () => {
//       const votes = [
//         { user: daoUser1, option: 1, stake: 250_000_000 },
//         { user: daoUser2, option: 1, stake: 240_550_000 },
//         { user: daoUser3, option: 1, stake: 8_500_000 },
//       ];

//       for (const v of votes) {
//         await vote(v.user, v.option, v.stake);
//       }

//       console.log("All DAO votes completed ✅");
//     });

//     it("Resolve Event Market", async () => {
//       const [resolverUserPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("user_v1"), user1.publicKey.toBuffer()],
//         program.programId
//       );

//       const [daoVaultPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("prediction_market_dao_vault")],
//         program.programId
//       );

//       await program.methods
//         .resolveEventMarket()
//         .accounts({
//           resolver: user1.publicKey,
//           user: resolverUserPda,
//           market: eventMarketPda,
//           marketVault: eventMarketVault,
//           dao: daoPda,
//           daoVault: daoVaultPda,
//         })
//         .signers([user1])
//         .rpc();

//       console.log("Event resolved ✅");

//       const market = await program.account.eventMarket.fetch(eventMarketPda);

//       console.log("Final Outcome:", market.finalOutcome);
//       console.log("Voting Status:", market.votingStatus);

//       if (market.finalOutcome === null) {
//         throw new Error("Resolution failed");
//       }
//     });

//     const claimStakeFor = async (user: Keypair) => {
//       const [daoUserPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("dao_user"), user.publicKey.toBuffer()],
//         program.programId
//       );

//       const [votePda] = PublicKey.findProgramAddressSync(
//         [
//           Buffer.from("vote"),
//           user.publicKey.toBuffer(),
//           eventMarketPda.toBuffer(),
//         ],
//         program.programId
//       );

//       await program.methods
//         .claimStake()
//         .accounts({
//           user: user.publicKey,
//           daoUser: daoUserPda,
//           market: eventMarketPda,
//           vote: votePda,
//           systemProgram: SystemProgram.programId,
//         })
//         .signers([user])
//         .rpc();

//       const daoUserAcc = await program.account.daoUser.fetch(daoUserPda);

//       console.log(
//         `Claim → ${user.publicKey.toBase58()} | free=${daoUserAcc.freeAmount.toString()}`
//       );
//     };

//     it("Claim Stake (All DAO Users)", async () => {
//       await claimStakeFor(daoUser1); // loser
//       await claimStakeFor(daoUser2); // winner
//       await claimStakeFor(daoUser3); // winner

//       console.log("All claims processed ✅");
//     });


//     const claimRewardFor = async (user: Keypair, optionIndex: number) => {
//       const market = await program.account.eventMarket.fetch(eventMarketPda);

//       const optionMint = market.options[optionIndex].mint;

//       const [userPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("user_v1"), user.publicKey.toBuffer()],
//         program.programId
//       );

//       const userATA = await anchor.utils.token.associatedAddress({
//         mint: optionMint,
//         owner: user.publicKey,
//       });

//       const beforeBalance = await provider.connection.getBalance(user.publicKey);

//       await program.methods
//         .claimEventWinningReward()
//         .accounts({
//           buyer: user.publicKey,
//           user: userPda,
//           market: eventMarketPda,
//           tokenMint: optionMint,
//           marketVault: eventMarketVault,
//           tokenAccount: userATA,
//           associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
//           tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
//           systemProgram: SystemProgram.programId,
//           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//         })
//         .signers([user])
//         .rpc();

//       const afterBalance = await provider.connection.getBalance(user.publicKey);

//       console.log(
//         `Claim reward → ${user.publicKey.toBase58()} | before=${beforeBalance} after=${afterBalance}`
//       );

//       return { beforeBalance, afterBalance };
//     };

//     it("Claim Rewards (Users)", async () => {
//       // user1 → loser (NO)
//       const res1 = await claimRewardFor(user1, 0);

//       if (res1.afterBalance > res1.beforeBalance) {
//         throw new Error("Loser should not receive reward");
//       }

//       console.log("User1 correctly received nothing ❌");

//       // user2 → winner (YES)
//       try {
//         const res2 = await claimRewardFor(user2, 1);

//         if (res2.afterBalance <= res2.beforeBalance) {
//           throw new Error("Winner did not receive reward");
//         }

//         console.log("User2 correctly received reward ✅");
//       } catch (err: any) {
//         if (err?.logs) {
//           console.log("Transaction logs:", err.logs);
//         } else {
//           // SendTransactionError has getLogs()
//           const logs = await err.getLogs(provider.connection);
//           console.log("Logs:", logs);
//         }
//         throw err;
//       }

//     });
// });