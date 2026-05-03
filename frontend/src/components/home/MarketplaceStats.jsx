import { useState, useEffect } from "react";
import { useProgram } from "../../hooks/useProgram";
import { getMarketplacePda, getDaoPda } from "../../utils/pdas";
import { shortenAddress, formatSOL } from "../../utils/formatters";
import Spinner from "../ui/Spinner";

function StatBox({ label, value, sub, accent = false }) {
  return (
    <div className="p-5 rounded-2xl bg-panel border border-border flex flex-col gap-1">
      <p className="text-xs font-mono text-muted uppercase tracking-widest">{label}</p>
      <p className={`font-display text-3xl tracking-wide ${accent ? "text-accent" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function MarketplaceStats() {
  const program = useProgram();
  const [marketplace, setMarketplace] = useState(null);
  const [dao, setDao] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program) return;
    const load = async () => {
      try {
        const [mpPda] = getMarketplacePda();
        const [daoPda] = getDaoPda();
        const [mpAcc, daoAcc] = await Promise.allSettled([
          program.account.predictionMarketPlaceDetails.fetch(mpPda),
          program.account.dao.fetch(daoPda),
        ]);
        if (mpAcc.status === "fulfilled") setMarketplace(mpAcc.value);
        if (daoAcc.status === "fulfilled") setDao(daoAcc.value);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [program]);

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <section className="max-w-7xl mx-auto px-6 mb-16">
      <div className="glow-line mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketplace ? (
          <>
            <StatBox label="Total Markets" value={marketplace.totalMarkets?.toString() ?? "—"} sub="price + event markets" accent />
            <StatBox label="Marketplace Creator" value={shortenAddress(marketplace.creator?.toBase58())} sub="contract admin" />
            <StatBox label="Platform Fee" value={`${marketplace.feePercent ?? "—"}%`} sub="taken on winnings" />
          </>
        ) : (
          <div className="col-span-3 flex items-center gap-3 p-5 rounded-2xl bg-panel border border-border text-muted text-sm">
            <Spinner size="sm" /> Could not load marketplace data. Check your program ID and IDL.
          </div>
        )}
        {dao ? (
          <StatBox label="DAO Total Stake" value={`${formatSOL(dao.daoTotalStake?.toNumber())} SOL`} sub={`${dao.totalMembers?.toString() ?? "?"} DAO members`} accent />
        ) : (
          <div className="p-5 rounded-2xl bg-panel border border-border text-muted text-sm flex items-center gap-2">
            <Spinner size="sm" /> DAO not loaded
          </div>
        )}
      </div>
      {dao && (
        <div className="mt-4 p-5 rounded-2xl bg-panel border border-border">
          <p className="text-xs font-mono text-muted uppercase tracking-widest mb-3">DAO Details</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-muted text-xs mb-0.5">Creator</p>
              <p className="font-mono text-white">{shortenAddress(dao.creator?.toBase58(), 6)}</p>
            </div>
            <div>
              <p className="text-muted text-xs mb-0.5">Total Stake</p>
              <p className="font-mono text-accent">{formatSOL(dao.daoTotalStake?.toNumber())} SOL</p>
            </div>
            <div>
              <p className="text-muted text-xs mb-0.5">Members</p>
              <p className="font-mono text-white">{dao.totalMembers?.toString() ?? "—"}</p>
            </div>
          </div>
        </div>
      )}
      <div className="glow-line mt-8" />
    </section>
  );
}