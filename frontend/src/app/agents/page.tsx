"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useNotification } from "@/context/NotificationContext";
import { registerAgentOnChain } from "@/contracts/clientContracts";
import { 
  Cpu, 
  ShieldCheck, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  AlertOctagon, 
  Copy, 
  Check, 
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Wallet,
  AlertTriangle
} from "lucide-react";

export default function AgentsPage() {
  const { account, environment, signer, isCorrectNetwork, contractAddresses, connectWallet } = useWeb3();
  const { notify } = useNotification();

  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customAgentId, setCustomAgentId] = useState("");
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState("research");
  const [wallet, setWallet] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  
  // Real transaction loading state
  const [regLoading, setRegLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Reputation Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simInitial, setSimInitial] = useState(80);
  const [simActions, setSimActions] = useState<string[]>(["pass", "pass", "fail", "pass"]);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const handleRunSimulation = async (actionsToRun?: string[]) => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/reputation/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starting_reputation: simInitial,
          sequence: actionsToRun || simActions
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  const fetchAgents = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const copyAddress = (addr: string, id: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setLastTxHash(null);

    const generatedId = (customAgentId.trim() || `agent-${agentType}-${Math.floor(1000 + Math.random() * 9000)}`).toLowerCase();
    const effectiveWallet = (wallet.trim() || account || "").trim();
    const effectiveUri = metadataUri.trim() || `ipfs://QmTrustMesh/${generatedId}`;

    if (!name.trim()) {
      setRegError("Agent name is required.");
      setRegLoading(false);
      return;
    }
    if (!effectiveWallet.startsWith("0x") || effectiveWallet.length !== 42) {
      setRegError("Valid 42-character Ethereum/MST hex wallet address required (0x...).");
      setRegLoading(false);
      return;
    }

    try {
      let txHash: string | undefined = undefined;

      // In MST_TESTNET mode, perform genuine on-chain registration
      if (environment === "MST_TESTNET") {
        if (!contractAddresses.agentRegistry) {
          throw new Error("AgentRegistry contract is not deployed on MST Testnet yet. Deploy contracts before registering agents on-chain.");
        }
        if (!account || !signer) {
          throw new Error("Wallet not connected. Please connect your Web3 wallet (MetaMask / BridgeKey) to register on MST Testnet.");
        }
        if (!isCorrectNetwork) {
          throw new Error("Connected to wrong network. Please switch to MST Testnet (Chain ID: 91562037 / 4545) before signing.");
        }

        setLoadingStep("REQUESTING WALLET CONFIRMATION...");
        notify({
          type: "info",
          title: "Wallet Signature Requested",
          message: "Please confirm the registerAgent transaction in your wallet.",
        });

        const onChainRes = await registerAgentOnChain(
          signer,
          contractAddresses.agentRegistry,
          generatedId,
          agentType,
          effectiveWallet,
          effectiveUri
        );

        txHash = onChainRes.txHash;
        setLastTxHash(txHash);
        setLoadingStep("WAITING FOR BLOCKCHAIN CONFIRMATION...");
        
        notify({
          type: "info",
          title: "Transaction Broadcast",
          message: `Registration transaction sent to MST Testnet. Waiting for block confirmation.`,
          txHash,
        });
      } else {
        setLoadingStep("REGISTERING AGENT OFF-CHAIN (LOCAL DEMO)...");
      }

      // Step 2: Index registration in Backend Database
      setLoadingStep("INDEXING IN MESH REGISTRY...");
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: generatedId,
          name: name.trim() || `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Autonomous Node`,
          agent_type: agentType,
          wallet_address: effectiveWallet,
          metadata_uri: effectiveUri,
          blockchain_registered: Boolean(txHash),
          blockchain_tx_hash: txHash || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Database indexing failed");
      }

      notify({
        type: "success",
        title: "Agent Registered Successfully",
        message: `${name || generatedId} is now active in the Agent Mesh.`,
        txHash,
      });

      await fetchAgents();
      setIsModalOpen(false);
      setName("");
      setWallet("");
      setMetadataUri("");
    } catch (err: any) {
      console.error(err);
      const msg = err?.reason || err?.message || "Registration failed";
      setRegError(msg);
      notify({
        type: "error",
        title: "Registration Failed",
        message: msg,
      });
    } finally {
      setRegLoading(false);
      setLoadingStep(null);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesFilter = filterType === "ALL" || agent.agent_type.toUpperCase() === filterType;
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.agent_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.wallet_address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Cpu className="text-[#00f2fe]" size={28} />
            <span>Agent Registry & Leaderboard</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Autonomous agent identities, wallet bindings, and verifiable reputation on MST Blockchain.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAgents}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-[#00f2fe]" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] hover:scale-[1.02] transition"
          >
            <PlusCircle size={15} />
            <span>Register Agent</span>
          </button>
        </div>
      </div>

      {/* Mode Indicator Banner */}
      <div className={`p-4 rounded-xl border text-xs flex justify-between items-center ${
        environment === "MST_TESTNET"
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-300"
      }`}>
        <div className="flex items-center gap-2">
          {environment === "MST_TESTNET" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>
            <strong>Current Mode: {environment.replace("_", " ")}</strong> —{" "}
            {environment === "MST_TESTNET"
              ? "Agent registrations trigger real on-chain transactions to AgentRegistry.sol via your connected wallet."
              : "Registrations are recorded in the off-chain application state without requiring testnet gas."}
          </span>
        </div>
      </div>

      {/* Reputation Engine Math & Invariant Card */}
      <div className="glass-panel p-5 border border-white/10 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Reputation Registry Invariants
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                15.5x Asymmetric Penalty
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
              TrustMesh implements game-theoretic deterrence: Honest verification awards <strong>+2</strong> reputation, while dishonest or faulty execution penalizes <strong>-31</strong>. A single failure requires <strong>16 consecutive verified tasks</strong> to remediate.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextState = !showSimulator;
                setShowSimulator(nextState);
                if (nextState && !simResult) {
                  handleRunSimulation();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 font-bold text-xs transition font-mono flex items-center gap-1.5"
            >
              <span>{showSimulator ? "Hide Simulator" : "Interactive Simulator"}</span>
            </button>
          </div>
        </div>

        {/* Reputation Rules KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-2 border-t border-white/5">
          <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-center">
            <span className="text-gray-500 text-[10px] block">INITIAL SCORE</span>
            <span className="text-white font-bold text-sm">80 / 100</span>
          </div>
          <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-center">
            <span className="text-gray-500 text-[10px] block">PASS BONUS</span>
            <span className="text-emerald-400 font-bold text-sm">+2 Score</span>
          </div>
          <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-center">
            <span className="text-gray-500 text-[10px] block">FAIL PENALTY</span>
            <span className="text-rose-400 font-bold text-sm">-31 Score</span>
          </div>
          <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-center">
            <span className="text-gray-500 text-[10px] block">UNTRUSTED THRESHOLD</span>
            <span className="text-amber-400 font-bold text-sm">&lt; 40 Score</span>
          </div>
        </div>

        {/* Interactive Simulator Section */}
        {showSimulator && (
          <div className="bg-black/50 p-4 rounded-xl border border-purple-500/30 flex flex-col gap-4 font-mono text-xs mt-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="font-bold text-white text-xs">Simulate Multi-Task Reputation Trajectory</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-[11px]">Start:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={simInitial}
                  onChange={(e) => setSimInitial(parseInt(e.target.value) || 80)}
                  className="w-16 px-2 py-1 rounded bg-black/60 border border-white/10 text-white text-center text-xs outline-none"
                />
              </div>
            </div>

            {/* Sequence Builder Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-400 text-[11px]">Sequence:</span>
              {simActions.map((act, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    act === "pass" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {idx + 1}. {act.toUpperCase()}
                </span>
              ))}

              <button
                onClick={() => setSimActions([...simActions, "pass"])}
                className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px]"
              >
                + Add Pass
              </button>
              <button
                onClick={() => setSimActions([...simActions, "fail"])}
                className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 text-[10px]"
              >
                + Add Fail
              </button>
              <button
                onClick={() => setSimActions(["pass", "pass", "fail", "pass"])}
                className="px-2 py-0.5 rounded bg-white/5 text-gray-400 hover:text-white text-[10px]"
              >
                Reset
              </button>
              <button
                onClick={() => handleRunSimulation()}
                disabled={simLoading}
                className="ml-auto px-3 py-1 rounded-lg bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs"
              >
                {simLoading ? "Calculating..." : "Compute Trajectory"}
              </button>
            </div>

            {/* Simulation Results Table */}
            {simResult && (
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center text-[11px] text-gray-300">
                  <span>Start: <strong>{simResult.starting_reputation}</strong></span>
                  <span>End: <strong className={simResult.final_reputation < 40 ? "text-rose-400" : "text-emerald-400"}>{simResult.final_reputation}</strong></span>
                  <span>Net: <strong className={simResult.net_change >= 0 ? "text-emerald-400" : "text-rose-400"}>{simResult.net_change >= 0 ? `+${simResult.net_change}` : simResult.net_change}</strong></span>
                  <span>Status: <strong className={simResult.untrusted_triggered ? "text-rose-400" : "text-emerald-400"}>{simResult.untrusted_triggered ? "UNTRUSTED FLAG TRIGGERED" : "REPUTABLE"}</strong></span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500">
                        <th className="py-1">Step</th>
                        <th>Action</th>
                        <th>Score Before</th>
                        <th>Delta</th>
                        <th>Score After</th>
                        <th>Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResult.steps.map((st: any) => (
                        <tr key={st.step} className="border-b border-white/5">
                          <td className="py-1 text-gray-400">{st.step}</td>
                          <td className={st.action === "pass" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {st.action.toUpperCase()}
                          </td>
                          <td className="text-gray-300">{st.reputation_before}</td>
                          <td className={st.delta > 0 ? "text-emerald-400" : "text-rose-400"}>
                            {st.delta > 0 ? `+${st.delta}` : st.delta}
                          </td>
                          <td className="text-white font-bold">{st.reputation_after}</td>
                          <td>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              st.status === "UNTRUSTED" ? "bg-rose-500/20 text-rose-400" : st.status === "PROBATION" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                            }`}>
                              {st.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-[#00f2fe] font-mono transition"
            placeholder="Search by name, ID, or wallet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
          {["ALL", "RESEARCH", "PRICING", "ANALYSIS", "VERIFICATION"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterType === t
                  ? "bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/40"
                  : "text-gray-400 hover:text-white bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAgents.map((agent) => {
          const isVerifier = agent.agent_type === "verification";
          const isUntrusted = agent.reputation < 40 || agent.status === "UNTRUSTED";
          const repColor = agent.reputation >= 80 ? "text-emerald-400" : agent.reputation >= 50 ? "text-amber-400" : "text-rose-400";
          const repFill = agent.reputation >= 80 ? "bg-emerald-500" : agent.reputation >= 50 ? "bg-amber-500" : "bg-rose-500";

          return (
            <div
              key={agent.agent_id}
              className={`glass-panel p-5 border flex flex-col justify-between transition hover:border-white/25 ${
                isVerifier
                  ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent"
                  : isUntrusted
                  ? "border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-transparent"
                  : "border-white/10"
              }`}
            >
              <div>
                {/* Identity Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVerifier ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20"}`}>
                      {isVerifier ? <ShieldCheck size={20} /> : <Cpu size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{agent.name}</span>
                        {isVerifier && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            ISOLATED
                          </span>
                        )}
                      </h3>
                      <div className="font-mono text-xs text-gray-400">{agent.agent_id}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${isUntrusted ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
                      {agent.status}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase font-mono">{agent.agent_type}</span>
                  </div>
                </div>

                {/* Reputation Bar */}
                <div className="my-3">
                  <div className="flex justify-between items-center text-xs font-mono mb-1">
                    <span className="text-gray-400">Reputation Score</span>
                    <span className={`font-bold ${repColor}`}>{agent.reputation} / 100</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${repFill}`}
                      style={{ width: `${Math.max(0, Math.min(100, agent.reputation))}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono text-center mb-3">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Tasks</div>
                    <div className="text-xs font-bold text-white mt-0.5">{agent.tasks_completed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Verified</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">{agent.tasks_verified}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Pass Rate</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {agent.tasks_completed > 0 ? `${Math.round((agent.tasks_verified / agent.tasks_completed) * 100)}%` : "100%"}
                    </div>
                  </div>
                </div>

                {/* Wallet Line */}
                <div className="flex justify-between items-center bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 font-mono text-xs text-gray-400">
                  <span>{agent.wallet_address.slice(0, 10)}...{agent.wallet_address.slice(-6)}</span>
                  <button
                    onClick={() => copyAddress(agent.wallet_address, agent.agent_id)}
                    className="hover:text-[#00f2fe] transition"
                    title="Copy wallet"
                  >
                    {copiedId === agent.agent_id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Action */}
              <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                <Link
                  href={`/agents/${agent.agent_id}`}
                  className="text-xs font-semibold text-[#00f2fe] flex items-center gap-1 hover:underline"
                >
                  <span>Agent History & Audits</span>
                  <ArrowRight size={12} />
                </Link>
                <span className="text-[10px] font-mono text-gray-500">
                  {agent.registered_at ? new Date(agent.registered_at).toLocaleDateString() : "Genesis"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Register Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 border border-[#00f2fe]/30 bg-[#0d1322] shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle size={18} className="text-[#00f2fe]" />
                <span>Register Autonomous Agent</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-lg">×</button>
            </div>

            <form onSubmit={handleRegisterAgent} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Agent ID <span className="text-gray-500 font-normal">(Leave blank to auto-generate)</span>
                </label>
                <input
                  type="text"
                  placeholder={`agent-${agentType}-...`}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono outline-none focus:border-[#00f2fe]"
                  value={customAgentId}
                  onChange={(e) => setCustomAgentId(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Agent Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Market Pricing Oracle Alpha"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none focus:border-[#00f2fe]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Agent Specialization</label>
                <select
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none focus:border-[#00f2fe]"
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                >
                  <option value="research">Research Agent</option>
                  <option value="pricing">Pricing & Market Oracle</option>
                  <option value="analysis">Risk & Analysis Agent</option>
                  <option value="verification">Verification Agent</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Wallet Address (Defaults to connected wallet)
                </label>
                <input
                  type="text"
                  placeholder={account || "0x..."}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono outline-none focus:border-[#00f2fe]"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Metadata URI (IPFS / URI)
                </label>
                <input
                  type="text"
                  placeholder="ipfs://QmTrustMesh/..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono outline-none focus:border-[#00f2fe]"
                  value={metadataUri}
                  onChange={(e) => setMetadataUri(e.target.value)}
                />
              </div>

              {environment === "MST_TESTNET" && !contractAddresses.agentRegistry && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>AgentRegistry is not deployed on MST Testnet yet. Deploy contracts before submitting on-chain transactions.</span>
                </div>
              )}

              {environment === "MST_TESTNET" && !account && contractAddresses.agentRegistry && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between">
                  <span>Connect wallet to sign on MST Testnet</span>
                  <button
                    type="button"
                    onClick={connectWallet}
                    className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-[11px]"
                  >
                    Connect
                  </button>
                </div>
              )}

              {regError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  {regError}
                </div>
              )}

              {lastTxHash && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] flex justify-between items-center">
                  <span>TX: {lastTxHash.slice(0, 14)}...</span>
                  <a href={`https://mstscan.com/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                    MSTScan <ExternalLink size={10} />
                  </a>
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regLoading || (environment === "MST_TESTNET" && !contractAddresses.agentRegistry)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {regLoading ? (
                    <>
                      <span className="animate-spin font-mono">⚡</span>
                      <span>{loadingStep || "Processing..."}</span>
                    </>
                  ) : (
                    <span>Confirm Registration</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
