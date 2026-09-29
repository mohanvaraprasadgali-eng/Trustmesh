"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Hash, 
  Coins, 
  Cpu, 
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Filter,
  FileCode
} from "lucide-react";

interface TxItem {
  id: string;
  type: "PROOF_COMMITMENT" | "AGENT_REGISTRATION" | "CONTRACT_DEPLOYMENT";
  txHash: string;
  referenceId: string;
  title: string;
  contract?: string;
  status: "CONFIRMED" | "PENDING" | "FAILED";
  timestamp?: string;
  amount?: string;
  network?: string;
  chainId?: number;
  explorerUrl: string;
}

export default function TransactionsPage() {
  const { environment, contractAddresses, networkName, deploymentInfo, refreshContracts } = useWeb3();
  const [transactions, setTransactions] = useState<TxItem[]>([]);
  const [filterType, setFilterType] = useState<"ALL" | "DEPLOYMENT" | "PROOF" | "AGENT">("ALL");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      await refreshContracts();
      // 1. First attempt to fetch from backend aggregated endpoint
      const txRes = await fetch("/api/transactions").then((r) => r.json()).catch(() => null);

      if (txRes && Array.isArray(txRes.transactions) && txRes.transactions.length > 0) {
        const mapped: TxItem[] = txRes.transactions.map((t: any) => ({
          id: t.id || `tx-${t.tx_hash}`,
          type: t.type,
          txHash: t.tx_hash,
          referenceId: t.reference_id || t.agent_id || t.task_id || t.contract || "N/A",
          title: t.title || `${t.type}: ${t.contract || ""}`,
          contract: t.contract,
          status: t.status || "CONFIRMED",
          timestamp: t.timestamp,
          network: t.network || "MST Testnet",
          chainId: t.chain_id || 91562037,
          explorerUrl: t.explorer_url || `https://mstscan.com/tx/${t.tx_hash}`,
        }));
        setTransactions(mapped);
        return;
      }

      // 2. Fallback to tasks & agents API
      const [tasksRes, agentsRes] = await Promise.all([
        fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
        fetch("/api/agents").then((r) => r.json()).catch(() => ({ agents: [] })),
      ]);

      const txList: TxItem[] = [];

      // Extract task proof/settlement transactions with genuine on-chain hash
      (tasksRes.tasks || []).forEach((t: any) => {
        if (t.blockchain_tx_hash && t.blockchain_tx_hash.startsWith("0x")) {
          txList.push({
            id: `task-${t.task_id}`,
            type: "PROOF_COMMITMENT",
            txHash: t.blockchain_tx_hash,
            referenceId: t.task_id,
            title: `Task Proof: ${t.task_type.toUpperCase()}`,
            contract: "TaskEscrow",
            status: "CONFIRMED",
            timestamp: t.completed_at || t.created_at,
            amount: `${t.budget} tMSTC`,
            network: "MST Testnet",
            chainId: 91562037,
            explorerUrl: `https://mstscan.com/tx/${t.blockchain_tx_hash}`,
          });
        }
      });

      // Extract agent registration transactions with genuine on-chain hash
      (agentsRes.agents || []).forEach((a: any) => {
        if (a.blockchain_tx_hash && a.blockchain_tx_hash.startsWith("0x")) {
          txList.push({
            id: `agent-${a.agent_id}`,
            type: "AGENT_REGISTRATION",
            txHash: a.blockchain_tx_hash,
            referenceId: a.agent_id,
            title: `Register Agent: ${a.name}`,
            contract: "AgentRegistry",
            status: "CONFIRMED",
            timestamp: a.registered_at,
            network: "MST Testnet",
            chainId: 91562037,
            explorerUrl: `https://mstscan.com/tx/${a.blockchain_tx_hash}`,
          });
        }
      });

      setTransactions(txList);
    } catch (err) {
      console.error("Failed to load transactions", err);
    } finally {
      setLoading(false);
    }
  }, [refreshContracts]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const copyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredTxs = transactions.filter((tx) => {
    if (filterType === "DEPLOYMENT") return tx.type === "CONTRACT_DEPLOYMENT";
    if (filterType === "PROOF") return tx.type === "PROOF_COMMITMENT";
    if (filterType === "AGENT") return tx.type === "AGENT_REGISTRATION";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Clock className="text-[#00f2fe]" size={28} />
            <span>Blockchain Transactions Ledger</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Verifiable on-chain transactions recorded on the MST Blockchain and MSTScan explorer.
          </p>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-mono text-gray-300 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-[#00f2fe]" : ""} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Contract Deployments Reference */}
      <div className="glass-panel p-5 border border-white/10 flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <div className="text-gray-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
            <FileCode size={13} className="text-[#00f2fe]" />
            <span>Smart Contract Deployments ({environment.replace("_", " ")})</span>
          </div>
          <div className="text-[10px] text-[#00f2fe]">MST Testnet Chain ID: 91562037</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* AgentRegistry */}
          <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-semibold text-[11px]">AgentRegistry</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                contractAddresses.agentRegistry ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {contractAddresses.agentRegistry ? "Bytecode Verified" : "Not Deployed"}
              </span>
            </div>
            {contractAddresses.agentRegistry ? (
              <div className="flex items-center justify-between mt-1">
                <span className="text-white font-bold">{contractAddresses.agentRegistry.slice(0, 10)}...{contractAddresses.agentRegistry.slice(-6)}</span>
                <a
                  href={`https://mstscan.com/address/${contractAddresses.agentRegistry}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00f2fe] hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>MSTScan</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <span className="text-amber-400/90 text-[11px] font-sans">Contract not deployed on MST Testnet</span>
            )}
          </div>

          {/* ReputationRegistry */}
          <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-semibold text-[11px]">ReputationRegistry</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                contractAddresses.reputationRegistry ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {contractAddresses.reputationRegistry ? "Bytecode Verified" : "Not Deployed"}
              </span>
            </div>
            {contractAddresses.reputationRegistry ? (
              <div className="flex items-center justify-between mt-1">
                <span className="text-white font-bold">{contractAddresses.reputationRegistry.slice(0, 10)}...{contractAddresses.reputationRegistry.slice(-6)}</span>
                <a
                  href={`https://mstscan.com/address/${contractAddresses.reputationRegistry}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00f2fe] hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>MSTScan</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <span className="text-amber-400/90 text-[11px] font-sans">Contract not deployed on MST Testnet</span>
            )}
          </div>

          {/* TaskEscrow */}
          <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-semibold text-[11px]">TaskEscrow</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                contractAddresses.taskEscrow ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}>
                {contractAddresses.taskEscrow ? "Bytecode Verified" : "Not Deployed"}
              </span>
            </div>
            {contractAddresses.taskEscrow ? (
              <div className="flex items-center justify-between mt-1">
                <span className="text-white font-bold">{contractAddresses.taskEscrow.slice(0, 10)}...{contractAddresses.taskEscrow.slice(-6)}</span>
                <a
                  href={`https://mstscan.com/address/${contractAddresses.taskEscrow}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00f2fe] hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>MSTScan</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <span className="text-amber-400/90 text-[11px] font-sans">Contract not deployed on MST Testnet</span>
            )}
          </div>
        </div>
      </div>

      {/* Mode Warning */}
      {environment === "LOCAL_DEMO" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>Active Mode: Local Demo</strong>
            <p className="text-amber-300/80 mt-0.5">
              The dApp is running in Local Demo mode. Proofs and verification events are recorded and audited locally.
              To broadcast transactions on the live MST Testnet and inspect them on MSTScan, toggle to <strong>MST TESTNET</strong> mode in the top bar.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Transactions Table */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Broadcasted Transactions</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
              {filteredTxs.length}
            </span>
          </h3>

          <div className="flex gap-2 font-mono text-xs">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                filterType === "ALL" ? "bg-[#00f2fe]/20 text-[#00f2fe] border-[#00f2fe]/40" : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setFilterType("DEPLOYMENT")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                filterType === "DEPLOYMENT" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              Deployments
            </button>
            <button
              onClick={() => setFilterType("AGENT")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                filterType === "AGENT" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              Agent Registrations
            </button>
            <button
              onClick={() => setFilterType("PROOF")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                filterType === "PROOF" ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              Task Proofs
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-xs font-mono">
            Loading blockchain transactions...
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs font-mono flex flex-col items-center gap-2">
            <span className="text-base text-gray-300 font-bold">No MST Testnet transactions yet.</span>
            <span className="text-gray-500 max-w-md">
              Application is currently in LOCAL DEMO MODE. Cryptographic proofs and task attestations are generated off-chain in the local database. Blockchain transactions will record here once smart contracts are deployed to MST Testnet.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-gray-400 border-b border-white/10 pb-2 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Action Type</th>
                  <th className="py-2.5 px-3">Transaction Hash</th>
                  <th className="py-2.5 px-3">Reference / Target</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">MSTScan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxs.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.type === "CONTRACT_DEPLOYMENT"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : item.type === "PROOF_COMMITMENT"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {item.type === "CONTRACT_DEPLOYMENT"
                          ? "DEPLOYMENT"
                          : item.type === "PROOF_COMMITMENT"
                          ? "PROOF OF WORK"
                          : "AGENT REGISTER"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white flex items-center gap-2">
                      <span className="font-mono text-[#00f2fe]">
                        {item.txHash ? `${item.txHash.slice(0, 12)}...${item.txHash.slice(-8)}` : "Pending"}
                      </span>
                      {item.txHash && (
                        <button
                          onClick={() => copyHash(item.txHash, item.id)}
                          className="text-gray-400 hover:text-white transition"
                          title="Copy full hash"
                        >
                          {copied === item.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-300">
                      <div>{item.title}</div>
                      <div className="text-[10px] text-gray-500">{item.referenceId}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold flex items-center gap-1 ${
                        item.status === "CONFIRMED"
                          ? "text-emerald-400"
                          : item.status === "PENDING"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}>
                        <CheckCircle2 size={13} /> {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {item.txHash ? (
                        <a
                          href={item.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00f2fe] inline-flex items-center gap-1 hover:underline font-bold"
                        >
                          <span>View</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
