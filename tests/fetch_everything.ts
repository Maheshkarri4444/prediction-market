import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

describe("fetch-all-data", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program; // change this

  it("Fetch all on-chain data", async () => {
    console.log("\n========== FETCHING ALL DATA ==========\n");

    // ---------------- USERS ----------------
    const users = await program.account.user.all();
    console.log("🔹 USERS:");
    users.forEach((u, i) => {
      console.log(`User ${i}:`, {
        pubkey: u.publicKey.toBase58(),
        data: u.account,
      });
    });

    // ---------------- MARKETPLACE ----------------
    const marketplaces =
      await program.account.predictionMarketPlaceDetails.all();

    console.log("\n🔹 PREDICTION MARKETPLACE:");
    marketplaces.forEach((m) => {
      console.log({
        pubkey: m.publicKey.toBase58(),
        data: m.account,
      });
    });

    // ---------------- DAO ----------------
    const daos = await program.account.dao.all();
    console.log("\n🔹 DAO:");
    daos.forEach((d) => {
      console.log({
        pubkey: d.publicKey.toBase58(),
        data: d.account,
      });
    });

    // ---------------- MARKETS ----------------
    const markets = await program.account.market.all();
    console.log("\n🔹 MARKETS:");
    markets.forEach((m, i) => {
      console.log(`Market ${i}:`, {
        pubkey: m.publicKey.toBase58(),
        data: m.account,
      });
    });

    // ---------------- ORDERS ----------------
    const orders = await program.account.order.all();
    console.log("\n🔹 ORDERS:");
    orders.forEach((o, i) => {
      console.log(`Order ${i}:`, {
        pubkey: o.publicKey.toBase58(),
        data: o.account,
      });
    });

    // ---------------- EVENT MARKETS ----------------
    let eventMarkets = [];
    try {
      eventMarkets = await program.account.eventMarket.all();
    } catch (e) {
      console.log("\n⚠️ No event markets or account not defined");
    }

    console.log("\n🔹 EVENT MARKETS:");
    eventMarkets.forEach((m, i) => {
      console.log(`Event Market ${i}:`, {
        pubkey: m.publicKey.toBase58(),
        data: m.account,
      });
    });

    // ---------------- EVENT ORDERS ----------------
    let eventOrders = [];
    try {
      eventOrders = await program.account.eventOrder.all();
    } catch (e) {
      console.log("\n⚠️ No event orders or account not defined");
    }

    console.log("\n🔹 EVENT ORDERS:");
    eventOrders.forEach((o, i) => {
      console.log(`Event Order ${i}:`, {
        pubkey: o.publicKey.toBase58(),
        data: o.account,
      });
    });

    // ---------------- VOTES ----------------
    let votes = [];
    try {
      votes = await program.account.vote.all();
    } catch (e) {
      console.log("\n⚠️ No votes or account not defined");
    }

    console.log("\n🔹 VOTES:");
    votes.forEach((v, i) => {
      console.log(`Vote ${i}:`, {
        pubkey: v.publicKey.toBase58(),
        data: v.account,
      });
    });

    // ---------------- EXTRA (optional useful) ----------------
    console.log("\n🔹 EXTRA INFO:");

    console.log("Total Users:", users.length);
    console.log("Total Markets:", markets.length);
    console.log("Total Orders:", orders.length);
    console.log("Total Event Markets:", eventMarkets.length);
    console.log("Total Event Orders:", eventOrders.length);
    console.log("Total Votes:", votes.length);

    console.log("\n========== DONE ==========\n");
  });
});