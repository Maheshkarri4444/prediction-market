import fetch from "node-fetch";

it("fetch pyth feeds", async () => {
  const res = await fetch(
    "https://hermes.pyth.network/v2/price_feeds?asset_type=crypto"
  );

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const feeds = await res.json();

  for (const feed of feeds) {
    console.log(
      "Symbol:", feed.attributes?.symbol,
      "Feed:", feed.id
    );
  }
});