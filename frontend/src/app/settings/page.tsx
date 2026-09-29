"use client";

import React, { useState, useEffect } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { 
  Settings as SettingsIcon, 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  FileCode,
  RefreshCw
} from "lucide-react";

export default function SettingsPage() {
  const { environment, setEnvironment, contractAddresses, account, balance, isCorrectNetwork } = useWeb3();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <SettingsIcon className="text-[#00f2fe]" size={28} />
          <span>Protocol Configuration & Network Settings</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage MST Blockchain RPC parameters, environment modes, and contract bindings.
        </p>
      </div>

      {/* Environment Mode Setting */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#00f2fe]" />
          <span>Execution Environment</span>
        </h3>
        <p className="text-xs text-gray-400">
          TrustMesh supports two distinct operating modes. Never confused or faked.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setEnvironment("LOCAL_DEMO")}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              environment === "LOCAL_DEMO"
                ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "bg-white/5 border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-white text-sm">Local Demo Mode</span>
              {environment === "LOCAL_DEMO" && <span className="text-amber-400 text-xs font-bold font-mono">ACTIVE</span>}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Uses off-chain deterministic simulation and local state. Ideal for offline demonstrations, unit testing, and mentors walkthroughs.
            </p>
          </div>

          <div
            onClick={() => setEnvironment("MST_TESTNET")}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              environment === "MST_TESTNET"
                ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-white/5 border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-white text-sm">MST Testnet Mode</span>
              {environment === "MST_TESTNET" && <span className="text-emerald-400 text-xs font-bold font-mono">ACTIVE</span>}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Broadcasts real transactions to the live MST Testnet (`Chain ID: 91562037 / 4545`). Requires wallet signature and tMSTC gas.
            </p>
          </div>
        </div>
      </div>

      {/* Network & RPC Reference */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-4 font-mono text-xs">
        <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
          <span>MST Blockchain Network Parameters</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-gray-500 text-[10px] block">RPC ENDPOINT</span>
            <span className="text-[#00f2fe] font-bold">https://testnetrpc.mstblockchain.com</span>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-gray-500 text-[10px] block">CHAIN ID</span>
            <span className="text-white font-bold">91562037 (Live Node) / 4545 (Legacy)</span>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-gray-500 text-[10px] block">CURRENCY</span>
            <span className="text-emerald-400 font-bold">tMSTC (18 Decimals)</span>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-gray-500 text-[10px] block">EXPLORER</span>
            <a href="https://mstscan.com" target="_blank" rel="noopener noreferrer" className="text-[#00f2fe] flex items-center gap-1 hover:underline">
              <span>https://mstscan.com</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      {/* Faucet & Token Guide */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-3 text-xs">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Coins size={18} className="text-amber-400" />
          <span>MST Testnet Faucet & Wallet Setup</span>
        </h3>
        <p className="text-gray-300 leading-relaxed">
          To broadcast transactions on the MST Testnet:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-gray-400 leading-relaxed font-mono">
          <li>Install MetaMask or BridgeKey wallet in your browser.</li>
          <li>Click &quot;Switch to MST Testnet&quot; in the TrustMesh top bar to auto-add the network.</li>
          <li>
            Visit the official MST Faucet:{" "}
            <a
              href="https://faucet.masterstroke.academy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00f2fe] hover:underline"
            >
              https://faucet.masterstroke.academy
            </a>{" "}
            and request free testnet <code>tMSTC</code> tokens.
          </li>
        </ol>
      </div>
    </div>
  );
}
