import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import Button from "../components/ui/Button";
import { useProgram } from "../hooks/useProgram";
import { getUserPda } from "../utils/pdas";

const MAX_USERNAME = 30;

export default function RegisterNormalUser() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const program = useProgram();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!username.trim()) { setError("Username is required."); return; }
    if (username.length > MAX_USERNAME) { setError(`Max ${MAX_USERNAME} characters.`); return; }
    if (!program || !publicKey) { setError("Wallet not connected or IDL not loaded."); return; }

    setLoading(true);
    setError("");
    try {
      const [userPda] = getUserPda(publicKey);
      await program.methods
        .createUser(username.trim())
        .accounts({ user: publicKey, userAccount: userPda, systemProgram: SystemProgram.programId })
        .rpc();
      navigate("/marketplace");
    } catch (err) {
      console.error(err);
      setError(err?.message ?? "Transaction failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen grid-bg flex items-center justify-center px-6">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <button onClick={() => navigate("/register")} className="flex items-center gap-2 text-xs font-mono text-muted hover:text-white transition-colors mb-8">
          ← Back
        </button>
        <div className="p-8 rounded-2xl bg-panel border border-border">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="font-display text-3xl tracking-widest text-white mb-1">CREATE ACCOUNT</h1>
          <p className="text-muted text-sm mb-8">Choose a username. This will be stored on-chain.</p>

          <div className="mb-6">
            <label className="block text-xs font-mono text-muted uppercase tracking-widest mb-2">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value.slice(0, MAX_USERNAME)); setError(""); }}
                placeholder="e.g. satoshi42"
                maxLength={MAX_USERNAME}
                className="w-full bg-dim border border-border rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted">
                {username.length}/{MAX_USERNAME}
              </span>
            </div>
            {error && <p className="mt-2 text-xs text-crimson font-mono">{error}</p>}
          </div>

          <ul className="mb-8 space-y-1.5 text-xs font-mono">
            <li className={`flex items-center gap-2 ${username.length > 0 ? "text-accent" : "text-muted"}`}>
              <span>{username.length > 0 ? "✓" : "○"}</span> At least 1 character
            </li>
            <li className={`flex items-center gap-2 ${username.length <= MAX_USERNAME && username.length > 0 ? "text-accent" : "text-muted"}`}>
              <span>{username.length <= MAX_USERNAME && username.length > 0 ? "✓" : "○"}</span> Max {MAX_USERNAME} characters
            </li>
          </ul>

          <Button className="w-full" size="lg" onClick={handleRegister} loading={loading} disabled={!username.trim() || loading}>
            Create Account
          </Button>
          <p className="text-center text-xs text-muted mt-4 font-mono">A small SOL rent fee will be charged for on-chain storage.</p>
        </div>
      </div>
    </div>
  );
}