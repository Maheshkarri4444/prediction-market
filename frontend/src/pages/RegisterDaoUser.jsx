import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram, PublicKey, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useProgram } from "../hooks/useProgram";
import { DAO_CREATION_FEE, PINATA_JWT } from "../constants";
import Button from "../components/ui/Button";

// ─── Constants ────────────────────────────────────────────────────────────────
const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
const MAX_USERNAME = 32;
const MAX_SYMBOL = 10;
const PINATA_API = "https://api.pinata.cloud";

// ─── Pinata helpers ────────────────────────────────────────────────────────────
async function uploadFileToPinata(file, jwt) {
  const form = new FormData();
  form.append("file", file);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: file.name || "dao-nft-image" })
  );
  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata file upload failed: ${res.statusText}`);
  const data = await res.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}

async function uploadJsonToPinata(json, jwt) {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: json,
      pinataMetadata: { name: "dao-nft-metadata" },
    }),
  });
  if (!res.ok) throw new Error(`Pinata JSON upload failed: ${res.statusText}`);
  const data = await res.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}

// ─── PDA helpers ──────────────────────────────────────────────────────────────
function getMarketplacePda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("predictionmarketplace_v1")],
    programId
  );
}

function getDaoPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao")],
    programId
  );
}

function getDaoVaultPda(programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("prediction_market_dao_vault")],
    programId
  );
}

function getDaoUserPda(walletPublicKey, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dao_user"), walletPublicKey.toBuffer()],
    programId
  );
}

function getMetadataPda(mintPublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDot({ active, done, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border transition-all duration-300 ${
          done
            ? "bg-accent border-accent text-black"
            : active
            ? "border-accent text-accent bg-accent/10"
            : "border-border text-white/30 bg-transparent"
        }`}
      >
        {done ? "✓" : active ? "●" : "○"}
      </div>
      <span
        className={`text-[10px] font-mono tracking-wider uppercase ${
          active ? "text-accent" : done ? "text-white/60" : "text-white/20"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterDaoUser() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [username, setUsername] = useState("");
  const [symbol, setSymbol] = useState("");
  const [bio, setBio] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0=idle 1=uploading-img 2=uploading-meta 3=txn 4=done
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRegister = async () => {
    setError("");
    if (!username.trim()) return setError("Username is required.");
    if (username.length > MAX_USERNAME)
      return setError(`Username max ${MAX_USERNAME} chars.`);
    if (!symbol.trim()) return setError("Symbol is required.");
    if (symbol.length > MAX_SYMBOL)
      return setError(`Symbol max ${MAX_SYMBOL} chars.`);
    if (!imageFile) return setError("Profile image is required.");
    if (!program || !publicKey)
      return setError("Wallet not connected.");

    // Make sure PINATA_JWT is configured
    const jwt = PINATA_JWT;
    if (!jwt) return setError("Pinata JWT not configured in constants.");

    setLoading(true);
    try {
      // ── Step 1: Upload image to IPFS ──────────────────────────────────────
      setStep(1);
      const imageUri = await uploadFileToPinata(imageFile, jwt);

      // ── Step 2: Upload metadata JSON to IPFS ─────────────────────────────
      setStep(2);
      const metadata = {
        name: username.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: bio.trim() || `DAO Member: ${username.trim()}`,
        image: imageUri,
        attributes: [
          { trait_type: "Role", value: "DAO Member" },
          { trait_type: "Platform", value: "OracleX" },
        ],
        properties: {
          files: [{ uri: imageUri, type: imageFile.type }],
          category: "image",
        },
      };
      const metadataUri = await uploadJsonToPinata(metadata, jwt);

      // ── Step 3: Send on-chain transaction ─────────────────────────────────
      setStep(3);

      const mintKeypair = anchor.web3.Keypair.generate();

      const [daoPda] = getDaoPda(program.programId);
      const [daoVault] = getDaoVaultPda(program.programId);
      const [daoUserPda] = getDaoUserPda(publicKey, program.programId);

      const userNftAccount = await anchor.utils.token.associatedAddress({
        mint: mintKeypair.publicKey,
        owner: publicKey,
      });

      const [metadataPda] = getMetadataPda(mintKeypair.publicKey);

      await program.methods
        .createDaoUser(username.trim(), symbol.trim().toUpperCase(), metadataUri)
        .accounts({
          user: publicKey,
          dao: daoPda,
          daoVault: daoVault,
          daoUser: daoUserPda,
          daoNftMint: mintKeypair.publicKey,
          userNftAccount: userNftAccount,
          metadata: metadataPda,
          metadataProgram: METADATA_PROGRAM_ID,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc();

      setStep(4);
      setTimeout(() => navigate("/dao"), 1500);
    } catch (err) {
      console.error(err);
      setError(err?.message ?? "Transaction failed. Please try again.");
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const steps = ["Image", "Metadata", "On-chain", "Done"];

  return (
    <div className="relative min-h-screen grid-bg flex items-center justify-center px-6 py-16">
      {/* background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/5 blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg">
        {/* back */}
        <button
          onClick={() => navigate("/register")}
          className="flex items-center gap-2 text-xs font-mono text-white/40 hover:text-white transition-colors mb-8"
        >
          ← Back to role selection
        </button>

        {/* header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h1 className="font-display text-4xl tracking-widest text-white mb-2">
            DAO <span className="text-gold">MEMBERSHIP</span>
          </h1>
          <p className="text-white/50 text-sm max-w-sm mx-auto">
            Join as a governance member. A{" "}
            <span className="text-gold font-mono font-semibold">
              {DAO_CREATION_FEE} SOL
            </span>{" "}
            fee is required. An NFT will be minted to your wallet.
          </p>
        </div>

        {/* step indicator — only show while loading */}
        {loading && (
          <div className="flex items-center justify-center gap-6 mb-8">
            {steps.map((label, i) => (
              <StepDot
                key={label}
                label={label}
                active={step === i + 1}
                done={step > i + 1}
              />
            ))}
          </div>
        )}

        {/* form card */}
        <div className="p-8 rounded-2xl bg-panel border border-border space-y-6">

          {/* image upload */}
          <div>
            <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
              Profile Image <span className="text-gold">*</span>
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="relative w-full h-44 rounded-xl border-2 border-dashed border-border hover:border-gold/40 bg-dim cursor-pointer flex items-center justify-center overflow-hidden transition-all duration-200 group"
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                    <span className="text-xs font-mono text-white">
                      Click to change
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/30 group-hover:text-gold/60 transition-colors">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-xs font-mono">
                    Drop or click to upload
                  </span>
                  <span className="text-[10px] font-mono text-white/20">
                    PNG, JPG, GIF — will be stored on IPFS
                  </span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* username */}
          <div>
            <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
              Username <span className="text-gold">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.slice(0, MAX_USERNAME))
                }
                placeholder="e.g. satoshi_dao"
                maxLength={MAX_USERNAME}
                className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-white/20 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all duration-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">
                {username.length}/{MAX_USERNAME}
              </span>
            </div>
          </div>

          {/* symbol */}
          <div>
            <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
              NFT Symbol <span className="text-gold">*</span>
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) =>
                setSymbol(e.target.value.toUpperCase().slice(0, MAX_SYMBOL))
              }
              placeholder="e.g. ORACLE"
              maxLength={MAX_SYMBOL}
              className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-white/20 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all duration-200 uppercase"
            />
            <p className="text-[10px] font-mono text-white/30 mt-1">
              Short ticker for your DAO membership NFT (max {MAX_SYMBOL} chars)
            </p>
          </div>

          {/* bio */}
          <div>
            <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2">
              Bio{" "}
              <span className="text-white/30 normal-case tracking-normal font-sans">
                (optional)
              </span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 200))}
              placeholder="A short description stored in NFT metadata…"
              maxLength={200}
              rows={3}
              className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-white/20 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all duration-200 resize-none"
            />
            <p className="text-[10px] font-mono text-white/30 mt-1 text-right">
              {bio.length}/200
            </p>
          </div>

          {/* info callout */}
          <div className="flex gap-3 p-4 rounded-xl bg-gold/5 border border-gold/15">
            <span className="text-gold text-lg leading-none mt-0.5">ℹ</span>
            <div className="text-xs text-white/50 font-mono leading-relaxed space-y-1">
              <p>
                • Your image + metadata will be uploaded to{" "}
                <span className="text-white/70">IPFS via Pinata</span>
              </p>
              <p>
                • A unique NFT will be minted to your wallet via{" "}
                <span className="text-white/70">Metaplex</span>
              </p>
              <p>
                • A fee of{" "}
                <span className="text-gold font-semibold">
                  {DAO_CREATION_FEE} SOL
                </span>{" "}
                will be transferred to the DAO vault
              </p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              ⚠ {error}
            </p>
          )}

          {step === 4 ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="text-4xl">🎉</div>
              <p className="text-accent font-mono text-sm font-semibold">
                DAO membership created!
              </p>
              <p className="text-white/40 text-xs font-mono">
                Redirecting to dashboard…
              </p>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={handleRegister}
              loading={loading}
              disabled={!username.trim() || !symbol.trim() || !imageFile || loading}
              style={{
                background: loading ? undefined : "#c9a227",
                color: "#000",
              }}
            >
              {loading
                ? step === 1
                  ? "Uploading image to IPFS…"
                  : step === 2
                  ? "Uploading metadata to IPFS…"
                  : step === 3
                  ? "Sending transaction…"
                  : "Processing…"
                : `Join DAO — ${DAO_CREATION_FEE} SOL`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}