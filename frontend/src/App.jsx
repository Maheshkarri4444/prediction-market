import { useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import "@solana/wallet-adapter-react-ui/styles.css";

import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Home from "./pages/Home";
import Register from "./pages/Register";
import RegisterNormalUser from "./pages/RegisterNormalUser";
import RegisterDaoUser from "./pages/RegisterDaoUser";
import PredictionMarketPlace from "./pages/PredictionMarketPlace";
import DaoDashboard from "./pages/DaoDashboard";
import NotFound from "./pages/NotFound";

export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1 pt-16">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/register/user" element={<RegisterNormalUser />} />
                  <Route path="/register/dao" element={<RegisterDaoUser />} />
                  <Route path="/marketplace" element={<PredictionMarketPlace />} />
                  <Route path="/dao" element={<DaoDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}