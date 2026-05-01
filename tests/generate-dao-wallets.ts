// import { Keypair } from "@solana/web3.js";
// import * as fs from "fs";

// // number of wallets you want
// const NUM_WALLETS = 3;

// const wallets: any[] = [];

// for (let i = 0; i < NUM_WALLETS; i++) {
//   const kp = Keypair.generate();

//   wallets.push({
//     publicKey: kp.publicKey.toBase58(),
//     secretKey: Array.from(kp.secretKey), 
//   });

//   console.log(`Wallet ${i + 1}: ${kp.publicKey.toBase58()}`);
// }

// // save to file
// fs.writeFileSync("dao_wallets.json", JSON.stringify(wallets, null, 2));

// console.log("\n✅ DAO wallets saved to dao_wallets.json");

// Wallet 1: 3r7PsTcJJZLWNGboAj1YW8pmsFn5WHxoJkFYHSreekAh
// Wallet 2: 7mkByU2singRxZE81kCiJKLCpjh1ZAbHPfbGMP2U39YV
// Wallet 3: AT4hXxsGCPn8ynrNxUEgwhxmfdQ5zK9mxSeVPKisofWz