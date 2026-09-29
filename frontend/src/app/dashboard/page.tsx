"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { 
  Activity, 
  Cpu, 
  Layers, 
  Coins, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  PlusCircle,
  Play
} from "lucide-react";

export default function DashboardPage() {
  const { environment, account, balance, isCorrectNetwork, networkName } = useWeb3();
  const [health, setHealth] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [blockchainStats, setBlockchainStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [hRes, agRes, tkRes, bcRes] = await Promise.all([
        fetch("/api/health").catch(() => null),
        fetch("/api/agents").catch(() => null),
        fetch("/api/tasks").catch(() => null),
        fetch("/api/blockchain/stats").catch(() => null),
      ]);

      if (hRes && hRes.ok) setHealth(await hRes.json());
      if (agRes && agRes.ok) {
        const ag = await agRes.json();
        setAgents(ag.agents || []);
      }
      if (tkRes && tkRes.ok) {
        const tk = await tkRes.json();
        setTasks(tk.tasks || []);
      }
      if (bcRes && bcRes.ok) setBlockchainStats(await bcRes.json());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Aggregate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "PAID" || t.status === "REFUNDED" || t.status === "VERIFIED");
  const verifiedTasks = tasks.filter((t) => t.verified === true);
  const failedTasks = tasks.filter((t) => t.verified === false);
  const proofsCount = tasks.filter((t) => t.proof_hash).length;

  const totalEscrowed = tasks.reduce((sum, t) => sum + (parseFloat(t.budget) || 0), 0).toFixed(2);
  const releasedPayment = tasks
    .filter((t) => t.payment_status === "RELEASED" || t.status === "PAID")
    .reduce((sum, t) => sum + (parseFloat(t.budget) || 0), 0)
    .toFixed(2);
  const refundedPayment = tasks
    .filter((t) => t.payment_status === "BLOCKED" || t.payment_status === "REFUNDED" || t.status === "REFUNDED")
    .reduce((sum, t) => sum + (parseFloat(t.budget) || 0), 0)
    .toFixed(2);

  const activeAgents = agents.filter((a) => a.status === "ACTIVE").length;
  const avgReputation = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + (a.reputation || 0), 0) / agents.length) : 80;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Activity className="text-[#00f2fe]" size={28} />
            <span>TrustMesh Operations Hub</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time multi-agent telemetry, escrow settlement, and on-chain verification metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-[#00f2fe]" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync State"}</span>
          </button>

          <Link
            href="/tasks/create"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] hover:scale-[1.02] transition"
          >
            <PlusCircle size={15} />
            <span>Create Task</span>
          </Link>
        </div>
      </div>

      {/* Network & Environment Banner */}
      <div className="glass-panel p-5 border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${environment === "MST_TESTNET" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white uppercase">{environment.replace("_", " ")}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${environment === "MST_TESTNET" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                {environment === "MST_TESTNET" ? "LIVE ON-CHAIN" : "LOCAL SIMULATION"}
              </span>
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              Target: {networkName} • Block #{blockchainStats?.block_number?.toLocaleString() || "5,787,000+"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-gray-500">Wallet: </span>
            <span className="text-gray-300">{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not Connected"}</span>
          </div>
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-gray-500">Balance: </span>
            <span className="text-emerald-400 font-semibold">{balance ? `${balance} tMSTC` : "0.00 tMSTC"}</span>
          </div>
        </div>
      </div>

      {/* 4 Main Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Agents */}
        <div className="glass-panel p-5 border border-white/10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agent Mesh</span>
            <Cpu size={18} className="text-[#00f2fe]" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-white font-mono">{agents.length}</div>
            <div className="text-xs text-gray-400 mt-1">
              <span className="text-emerald-400 font-semibold">{activeAgents} Active</span> • Avg Rep: {avgReputation}/100
            </div>
          </div>
          <Link href="/agents" className="text-xs text-[#00f2fe] flex items-center gap-1 font-semibold hover:underline">
            <span>View Registry</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Card 2: Tasks */}
        <div className="glass-panel p-5 border border-white/10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Tasks</span>
            <Layers size={18} className="text-purple-400" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-white font-mono">{totalTasks}</div>
            <div className="text-xs text-gray-400 mt-1">
              <span className="text-emerald-400 font-semibold">{verifiedTasks.length} Passed</span> •{" "}
              <span className="text-rose-400 font-semibold">{failedTasks.length} Slashed</span>
            </div>
          </div>
          <Link href="/tasks" className="text-xs text-purple-400 flex items-center gap-1 font-semibold hover:underline">
            <span>View Task History</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Card 3: Escrow Volume */}
        <div className="glass-panel p-5 border border-white/10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Escrow Volume</span>
            <Coins size={18} className="text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-white font-mono">{totalEscrowed} <span className="text-sm font-normal text-gray-400">tMSTC</span></div>
            <div className="text-xs text-gray-400 mt-1">
              Released: {releasedPayment} • Refunded: {refundedPayment}
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-mono">100% Escrow Enforced</span>
        </div>

        {/* Card 4: Verification Rate */}
        <div className="glass-panel p-5 border border-white/10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Verification Pass Rate</span>
            <ShieldCheck size={18} className="text-sky-400" />
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-white font-mono">
              {completedTasks.length > 0 ? `${Math.round((verifiedTasks.length / completedTasks.length) * 100)}%` : "100%"}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {proofsCount} Cryptographic Proofs Generated
            </div>
          </div>
          <Link href="/verification" className="text-xs text-sky-400 flex items-center gap-1 font-semibold hover:underline">
            <span>Verification Center</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Quick Interactive Demo Scenarios */}
      <div className="glass-panel p-6 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Play size={16} className="text-[#00f2fe]" />
              <span>Interactive Verification Scenarios (Deterministic Hackathon Demo)</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Launch pre-configured tasks to verify honest execution or test fraud detection and automatic slashing.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/tasks/create?preset=pricing-success"
            className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-emerald-400">🟢 Legitimate Task (Verified Flow)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                  +2 REPUTATION BONUS
                </span>
              </div>
              <p className="text-xs text-gray-300">
                Worker reports accurate pricing for Laptop X (₹59,999). Verifier checks reference data and confirms. Escrow releases payment to worker.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400 font-semibold group-hover:underline">
              <span>Execute Scenario</span>
              <ArrowRight size={12} />
            </div>
          </Link>

          <Link
            href="/tasks/create?preset=pricing-failure"
            className="p-4 rounded-xl bg-white/5 border border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50 transition flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-rose-400">🔴 Malicious Agent (Fraud Slashing Flow)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                  -31 SLASHING PENALTY
                </span>
              </div>
              <p className="text-xs text-gray-300">
                Worker intentionally reports a fake price (₹49,999). Independent Verifier catches discrepancy. Escrow blocks payment, refunds client, and applies reputation penalty.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-rose-400 font-semibold group-hover:underline">
              <span>Execute Scenario</span>
              <ArrowRight size={12} />
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Tasks Ledger Table */}
      <div className="glass-panel p-6 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers size={16} className="text-[#00f2fe]" />
            <span>Recent Task Escrow & Execution Feed</span>
          </h3>
          <Link href="/tasks" className="text-xs text-[#00f2fe] hover:underline font-semibold flex items-center gap-1">
            <span>View All Tasks ({tasks.length})</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No tasks recorded yet. Click &quot;Create Task&quot; above to initialize the first verifiable escrow task.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-gray-400 border-b border-white/10 pb-2 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Task ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Agent</th>
                  <th className="py-2.5 px-3">Budget</th>
                  <th className="py-2.5 px-3">Verification</th>
                  <th className="py-2.5 px-3">Proof Hash</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tasks.slice(0, 6).map((task) => (
                  <tr key={task.task_id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3 font-bold text-white">{task.task_id}</td>
                    <td className="py-3 px-3 text-purple-400 uppercase">{task.task_type}</td>
                    <td className="py-3 px-3 text-gray-300">{task.assigned_agent_id || "Orchestrator Assigning"}</td>
                    <td className="py-3 px-3 font-semibold text-emerald-400">{task.budget} tMSTC</td>
                    <td className="py-3 px-3">
                      {task.verified === true && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 size={13} />
                          PASS
                        </span>
                      )}
                      {task.verified === false && (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                          <XCircle size={13} />
                          FAIL
                        </span>
                      )}
                      {task.verified === null && <span className="text-amber-400">PENDING</span>}
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {task.proof_hash ? `${task.proof_hash.slice(0, 10)}...${task.proof_hash.slice(-6)}` : "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${task.payment_status === "PAID" ? "bg-emerald-500/20 text-emerald-400" : task.payment_status === "BLOCKED" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {task.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/tasks/${task.task_id}`}
                        className="text-[#00f2fe] hover:underline font-semibold"
                      >
                        Inspect →
                      </Link>
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
