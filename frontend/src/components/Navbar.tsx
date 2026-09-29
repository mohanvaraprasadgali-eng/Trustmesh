"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeb3 } from "@/context/Web3Context";
import { 
  Shield, 
  Wallet, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  ChevronDown,
  Layers,
  Activity,
  Cpu,
  FileCheck2,
  Clock,
  Settings
} from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { 
    account, 
    balance, 
    isConnecting, 
    connectWallet, 
    disconnectWallet, 
    environment, 
    setEnvironment,
    isCorrectNetwork,
    switchToMSTTestnet,
    networkName
  } = useWeb3();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/agents", label: "Agents", icon: Cpu },
    { href: "/tasks", label: "Tasks", icon: Layers },
    { href: "/verification", label: "Verification", icon: FileCheck2 },
    { href: "/transactions", label: "Transactions", icon: Clock },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#070a13]/90 backdrop-blur-xl border-b border-white/10">
      {/* Top Network & Environment Status Bar */}
      <div className="flex justify-between items-center px-6 py-1.5 bg-black/40 text-xs border-b border-white/5 font-mono">
        <div className="flex items-center gap-4">
          {/* Environment Switcher */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-md border border-white/10">
            <span className="text-gray-400 mr-1 text-[11px]">ENV:</span>
            <button
              onClick={() => setEnvironment("LOCAL_DEMO")}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                environment === "LOCAL_DEMO"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              LOCAL DEMO
            </button>
            <button
              onClick={() => setEnvironment("MST_TESTNET")}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                environment === "MST_TESTNET"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              MST TESTNET
            </button>
          </div>

          {/* Network Indicator */}
          <div className="flex items-center gap-2">
            {environment === "MST_TESTNET" && !isCorrectNetwork && account ? (
              <button
                onClick={switchToMSTTestnet}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30"
              >
                <AlertTriangle size={12} />
                <span>Switch to MST Testnet</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>{networkName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://mstscan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-gray-400 hover:text-[#00f2fe] transition"
          >
            <span>mstscan.com</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Main Nav Header */}
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex justify-between items-center">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00f2fe]/20 to-purple-500/20 border border-[#00f2fe]/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.2)] group-hover:scale-105 transition">
            <Shield className="text-[#00f2fe]" size={22} />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              Trust<span className="text-[#00f2fe]">Mesh</span>
            </div>
            <div className="text-[11px] text-gray-400 tracking-wide">
              Trust the Agent. Verify the Work.
            </div>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-[#00f2fe]/15 text-[#00f2fe] border border-[#00f2fe]/30 shadow-[0_0_10px_rgba(0,242,254,0.15)]"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Wallet Connection */}
        <div className="flex items-center gap-3">
          {account ? (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 font-mono text-xs">
              {balance !== null && (
                <span className="text-emerald-400 font-semibold border-r border-white/10 pr-2">
                  {balance} tMSTC
                </span>
              )}
              <span className="text-gray-300">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <button
                onClick={disconnectWallet}
                className="text-gray-400 hover:text-rose-400 ml-1 transition"
                title="Disconnect wallet"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-semibold text-sm shadow-[0_0_15px_rgba(0,242,254,0.25)] hover:shadow-[0_0_20px_rgba(0,242,254,0.4)] transition disabled:opacity-50"
            >
              <Wallet size={16} />
              <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
