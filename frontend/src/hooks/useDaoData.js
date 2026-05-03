import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "./useProgram";

const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// ── PDA helpers ────────────────────────────────────────────────────────────────
export function getDaoPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao")],
    programId
  );
}

export function getDaoVaultPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao_vault")],
    programId
  );
}

export function getDaoStakeAccountPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dao_stake_account")],
    programId
  );
}

export function getDaoUserPda(walletPublicKey, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dao_user"), walletPublicKey.toBuffer()],
    programId
  );
}

export function getMetadataPda(mintPublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
}

export function getVotePda(walletPublicKey, marketPda, programId) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("vote"),
      walletPublicKey.toBuffer(),
      marketPda.toBuffer(),
    ],
    programId
  );
}

// ── Fetch Metaplex metadata from URI ──────────────────────────────────────────
async function fetchNftMetadata(mintPublicKey) {
  try {
    const [metadataPda] = getMetadataPda(mintPublicKey);

    const { Connection } = await import("@solana/web3.js");
    const { RPC_ENDPOINT } = await import("../constants");
    const connection = new Connection(RPC_ENDPOINT, "confirmed");

    const accountInfo = await connection.getAccountInfo(metadataPda);
    if (!accountInfo) return null;

    const data = accountInfo.data;

    let offset = 1 + 32 + 32;

    const name = data
      .slice(offset, offset + 32)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    offset += 32;

    const symbol = data
      .slice(offset, offset + 10)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    offset += 10;

    const rawUri = data
    .slice(offset, offset + 200)
    .toString("utf8")
    .replace(/\0/g, "")
    .trim();

    const match = rawUri.match(/https?:\/\/[^\s"]+/);
    const uri = match ? match[0] : null;
    let offchain = null;
    console.log("Fetching off-chain metadata from URI:", uri);
    if (uri) {
      try {
        const res = await fetch(uri);
        if (res.ok) offchain = await res.json();
      } catch (_) {}
    }

    return {
      name,
      symbol: offchain?.symbol ?? symbol,
      uri,
      image: offchain?.image ?? null,
      description: offchain?.description ?? null,
      attributes: offchain?.attributes ?? [],
    };
  } catch (err) {
    console.warn("fetchNftMetadata error:", err);
    return null;
  }
}
// ── Main hook ─────────────────────────────────────────────────────────────────
export function useDaoData() {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [dao, setDao] = useState(null);
  const [daoUser, setDaoUser] = useState(null);
  const [nftMetadata, setNftMetadata] = useState(null);
  const [eventMarkets, setEventMarkets] = useState([]);
  const [myVotes, setMyVotes] = useState({}); // marketPubkey -> vote account
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setError(null);
    try {
      // ── DAO global account ─────────────────────────────────────────────────
      const [daoPda] = getDaoPda(program.programId);
      const daoAcc = await program.account.dao.fetch(daoPda);
      setDao({ ...daoAcc, publicKey: daoPda });

      // ── All event markets ──────────────────────────────────────────────────
      let markets = [];
      try {
        markets = await program.account.eventMarket.all();
      } catch (_) {}
      // Sort: unresolved first, then resolved
      markets.sort((a, b) => {
        if (a.account.resolved === b.account.resolved) return 0;
        return a.account.resolved ? 1 : -1;
      });
      setEventMarkets(markets);

      // ── Current user's daoUser + NFT metadata ─────────────────────────────
      if (publicKey) {
        try {
          const [daoUserPda] = getDaoUserPda(publicKey, program.programId);
          const daoUserAcc = await program.account.daoUser.fetch(daoUserPda);
          setDaoUser({ ...daoUserAcc, publicKey: daoUserPda });

          // Fetch NFT metadata from Metaplex
          const meta = await fetchNftMetadata(daoUserAcc.nftMint);
          console.log("Fetched NFT metadata:", meta);
          setNftMetadata(meta);

          // ── Fetch votes this user has cast ───────────────────────────────
          const votesMap = {};
          for (const m of markets) {
            try {
              const [votePda] = getVotePda(
                publicKey,
                m.publicKey,
                program.programId
              );
              const voteAcc = await program.account.vote.fetch(votePda);
              votesMap[m.publicKey.toBase58()] = {
                ...voteAcc,
                publicKey: votePda,
              };
            } catch (_) {
              // no vote cast for this market
            }
          }
          setMyVotes(votesMap);
        } catch (_) {
          // user is not a DAO member
          setDaoUser(null);
        }
      }
    } catch (err) {
      console.error("useDaoData error:", err);
      setError(err?.message ?? "Failed to load DAO data");
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { dao, daoUser, nftMetadata, eventMarkets, myVotes, loading, error, refresh: load };
}