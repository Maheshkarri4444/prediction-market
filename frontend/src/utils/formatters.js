export const shortenAddress = (addr, chars = 4) => {
  if (!addr) return "";
  const s = addr.toString();
  return `${s.slice(0, chars)}...${s.slice(-chars)}`;
};

export const formatSOL = (lamports) => {
  if (!lamports) return "0";
  return (lamports / 1e9).toFixed(4);
};

export const formatPrice = (price, expo) => {
  if (price === undefined || price === null) return "—";
  const val = price * Math.pow(10, expo ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const timeUntil = (unixTs) => {
  const diff = unixTs - Date.now() / 1000;
  if (diff <= 0) return "Ended";
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};