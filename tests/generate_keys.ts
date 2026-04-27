// import { Keypair } from "@solana/web3.js";
// import * as fs from "fs";

// // number of wallets you want
// const NUM_WALLETS = 2;

// const wallets: any[] = [];

// for (let i = 0; i < NUM_WALLETS; i++) {
// const kp = Keypair.generate();

// wallets.push({
// publicKey: kp.publicKey.toBase58(),
// secretKey: Array.from(kp.secretKey), // store as array
// });

// console.log(`Wallet ${i + 1}: ${kp.publicKey.toBase58()}`);
// }

// // save to file
// fs.writeFileSync("keys.json", JSON.stringify(wallets, null, 2));

// console.log("\n✅ Keys saved to keys.json");
