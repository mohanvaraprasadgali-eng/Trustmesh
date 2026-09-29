"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useNotifications } from "@/context/NotificationContext";
import { fundTaskOnChain } from "@/contracts/clientContracts";
import { 
  Coins, 
  ArrowLeft, 
  Play, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  FileText, 
  Hash,
  ArrowRight,
  ExternalLink,
  Wallet,
  Lock,
  Layers,
  Loader2,
  Cpu,
  Info
} from "lucide-react";

function CreateTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");

  const { 
    account, 
    environment, 
    setEnvironment,
    balance, 
    signer, 
    contractAddresses, 
    connectWallet, 
    switchToMSTTestnet,
    isCorrectNetwork 
  } = useWeb3();
  const { addNotification } = useNotifications();

  const [taskType, setTaskType] = useState<"auto" | "pricing" | "research" | "analysis">("auto");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("0.05");
  const [demoMode, setDemoMode] = useState<string>("");
  const [preferredAgent, setPreferredAgent] = useState<string>("");
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.agents) setAvailableAgents(data.agents);
      })
      .catch((err) => console.error("Failed to fetch agents for selector:", err));
  }, []);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isFundingOnly, setIsFundingOnly] = useState(false);
  const [executionPhase, setExecutionPhase] = useState<string>("");
  const [stepIndex, setStepIndex] = useState(0);
  const [onChainTxHash, setOnChainTxHash] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Apply query presets
  useEffect(() => {
    if (presetParam === "pricing-success") {
      setTaskType("pricing");
      setDescription("Find current market price and vendor deals for Laptop X");
      setBudget("0.05");
      setDemoMode("success");
    } else if (presetParam === "pricing-failure") {
      setTaskType("pricing");
      setDescription("Find current market price and vendor deals for Laptop X");
      setBudget("0.05");
      setDemoMode("failure");
    }
  }, [presetParam]);

  // Fund only (locks escrow and creates task, does not dispatch immediately)
  const handleFundOnly = async () => {
    setIsFundingOnly(true);
    setErrorMsg(null);
    try {
      if (environment === "MST_TESTNET") {
        if (!account || !signer) {
          addNotification({
            type: "warning",
            title: "Wallet Required",
            message: "Please connect your Web3 wallet to lock escrow on MST Testnet.",
          });
          await connectWallet();
          return;
        }

        if (balance && parseFloat(balance) < parseFloat(budget)) {
          throw new Error(
            `Insufficient balance (${balance} tMSTC) for escrow deposit of ${budget} tMSTC.`
          );
        }
      }

      // 1. Create task entry
      const createRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: taskType,
          description: description.trim(),
          budget: parseFloat(budget),
          preferred_agent_id: preferredAgent || null,
          demo_mode: demoMode || null,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.detail || "Task creation failed");
      }

      const createData = await createRes.json();
      const taskId = createData.task_id;

      // 2. Fund on-chain if testnet
      if (environment === "MST_TESTNET" && signer && contractAddresses.taskEscrow) {
        addNotification({
          type: "info",
          title: "Confirm Escrow Lock",
          message: `Please confirm transaction to lock ${budget} tMSTC into TaskEscrow.sol...`,
        });

        const { txHash } = await fundTaskOnChain(
          signer,
          contractAddresses.taskEscrow,
          taskId,
          budget
        );

        addNotification({
          type: "success",
          title: "Escrow Locked On-Chain",
          message: `Successfully locked ${budget} tMSTC on MST Blockchain`,
          txHash,
        });
      } else {
        addNotification({
          type: "success",
          title: "Escrow Reserved",
          message: `Task ${taskId} created with ${budget} tMSTC in escrow.`,
        });
      }

      router.push(`/tasks/${taskId}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Failed to fund escrow");
      addNotification({
        type: "error",
        title: "Escrow Deposit Failed",
        message: err?.message || "Failed to complete escrow transaction.",
      });
    } finally {
      setIsFundingOnly(false);
    }
  };

  // Full Pipeline Execution: Fund + Execute + Verify + Settle
  const handleExecuteWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setErrorMsg(null);
    setResult(null);
    setOnChainTxHash(null);
    setStepIndex(1);
    setExecutionPhase("Initializing task registry entry...");

    try {
      // 0. Balance and wallet check if in MST_TESTNET
      if (environment === "MST_TESTNET") {
        if (!account || !signer) {
          addNotification({
            type: "warning",
            title: "Wallet Required for Testnet Escrow",
            message: "Connecting wallet to lock actual tMSTC into escrow contract...",
          });
          await connectWallet();
        }

        if (balance && parseFloat(balance) < parseFloat(budget)) {
          throw new Error(
            `Insufficient tMSTC balance (${balance} tMSTC) for escrow budget of ${budget} tMSTC. Acquire funds from testnet faucet.`
          );
        }
      }

      // 1. Create task record via API
      setExecutionPhase("Registering task in TrustMesh database...");
      const createRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: taskType,
          description: description.trim(),
          budget: parseFloat(budget),
          preferred_agent_id: preferredAgent || null,
          demo_mode: demoMode || null,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.detail || "Task creation failed");
      }

      const createData = await createRes.json();
      const taskId = createData.task_id;

      // 1b. If in MST_TESTNET and signer available, fund escrow on-chain
      if (environment === "MST_TESTNET" && signer && contractAddresses.taskEscrow) {
        setExecutionPhase("Requesting escrow lock in MetaMask wallet...");
        addNotification({
          type: "info",
          title: "Confirm Escrow Lock",
          message: `Please confirm locking ${budget} tMSTC into TaskEscrow contract...`,
        });

        const { txHash } = await fundTaskOnChain(
          signer,
          contractAddresses.taskEscrow,
          taskId,
          budget
        );

        setOnChainTxHash(txHash);
        addNotification({
          type: "success",
          title: "Escrow Locked On-Chain",
          message: `Locked ${budget} tMSTC for ${taskId}`,
          txHash,
        });
      }

      setStepIndex(2); // 2. Worker agent assigned & computing
      setExecutionPhase("Autonomous Agent assigned — executing off-chain logic...");
      await new Promise((r) => setTimeout(r, 700));

      setStepIndex(3); // 3. Independent Verification
      setExecutionPhase("Isolated Verification Agent analyzing output & invariant rules...");

      // 2. Execute task through Orchestrator
      const execRes = await fetch(`/api/tasks/${taskId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!execRes.ok) {
        const err = await execRes.json();
        throw new Error(err.detail || "Workflow execution failed");
      }

      setStepIndex(4); // 4. Proof of Work Hashed
      setExecutionPhase("Computing canonical SHA-256 Proof of Agent Work...");
      await new Promise((r) => setTimeout(r, 600));

      const execData = await execRes.json();
      setStepIndex(5); // 5. Settlement complete
      setExecutionPhase("Settlement & dynamic reputation updated!");
      setResult(execData);

      if (execData.verification?.verified) {
        addNotification({
          type: "success",
          title: "Verification Passed (+2 Rep)",
          message: `Task ${taskId} verified authentic! Escrow payment released to agent.`,
          txHash: execData.blockchain_tx_hash || onChainTxHash || undefined,
        });
      } else {
        addNotification({
          type: "error",
          title: "Verification Failed (-31 Rep Slash)",
          message: `Task ${taskId} failed verification! Discrepancy detected. Client refunded.`,
          txHash: execData.blockchain_tx_hash || onChainTxHash || undefined,
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Execution error");
      addNotification({
        type: "error",
        title: "Task Execution Error",
        message: err?.message || "Failed to execute task pipeline.",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <Link href="/tasks" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition w-fit">
        <ArrowLeft size={14} />
        <span>Back to Tasks</span>
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <Coins className="text-[#00f2fe]" size={28} />
          <span>Create Verifiable Task Escrow</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Lock client budget into escrow, dispatch specialized agent, and verify output with isolated attestation.
        </p>
      </div>

      {/* Settlement Channel & Wallet Selector Card */}
      <div className="glass-panel p-5 border border-white/10 flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <Lock size={14} className="text-[#00f2fe]" />
            <span>Escrow Settlement Channel</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
            DUAL-ENGINE ARCHITECTURE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setEnvironment("LOCAL_DEMO")}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1.5 ${
              environment === "LOCAL_DEMO"
                ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-white text-xs font-mono">LOCAL DEMO SANDBOX</span>
              {environment === "LOCAL_DEMO" && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  SELECTED
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Zero gas, off-chain simulated escrow. Instant deterministic execution ideal for testing & mentor walkthroughs.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEnvironment("MST_TESTNET")}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1.5 ${
              environment === "MST_TESTNET"
                ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-white text-xs font-mono">MST TESTNET ESCROW</span>
              {environment === "MST_TESTNET" && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  SELECTED
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Real smart contract lock on TaskEscrow.sol (Chain ID: 91562037). Requires connected Web3 wallet & tMSTC.
            </p>
          </button>
        </div>

        {/* MST Testnet Wallet Status Details */}
        {environment === "MST_TESTNET" && (
          <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/30 flex items-center justify-between flex-wrap gap-3 font-mono text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Wallet size={16} />
              </div>
              <div>
                <div className="text-white font-bold text-xs">
                  {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Wallet Not Connected"}
                </div>
                <div className="text-gray-400 text-[10px]">
                  {balance !== null ? `Balance: ${balance} tMSTC` : "Connect to inspect tMSTC balance"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!account ? (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-xs hover:bg-emerald-500/30 transition"
                >
                  Connect Wallet
                </button>
              ) : !isCorrectNetwork ? (
                <button
                  type="button"
                  onClick={switchToMSTTestnet}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold text-xs hover:bg-rose-500/30 transition flex items-center gap-1"
                >
                  <AlertTriangle size={12} />
                  <span>Switch to MST Testnet</span>
                </button>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                  Ready on Chain 91562037
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preset Banner */}
      <div className="glass-panel p-4 border border-white/10 flex flex-wrap gap-2.5 items-center">
        <span className="text-xs font-semibold text-gray-400 font-mono">QUICK PROMPTS:</span>
        <button
          type="button"
          onClick={() => {
            setTaskType("auto");
            setDescription("How can I create an effective PowerPoint presentation for my college seminar?");
            setBudget("0.05");
            setDemoMode("");
          }}
          className="px-3 py-1 rounded-lg text-xs font-semibold font-mono bg-white/5 border border-white/10 text-[#00f2fe] hover:bg-white/10"
        >
          🎓 College Seminar PPT
        </button>

        <button
          type="button"
          onClick={() => {
            setTaskType("auto");
            setDescription("Explain neural networks in simple terms.");
            setBudget("0.05");
            setDemoMode("");
          }}
          className="px-3 py-1 rounded-lg text-xs font-semibold font-mono bg-white/5 border border-white/10 text-purple-400 hover:bg-white/10"
        >
          🧠 Neural Networks
        </button>

        <button
          type="button"
          onClick={() => {
            setTaskType("auto");
            setDescription("Compare Python and Java for a beginner.");
            setBudget("0.05");
            setDemoMode("");
          }}
          className="px-3 py-1 rounded-lg text-xs font-semibold font-mono bg-white/5 border border-white/10 text-emerald-400 hover:bg-white/10"
        >
          ⚖️ Python vs Java
        </button>

        <button
          type="button"
          onClick={() => {
            setTaskType("auto");
            setDescription("Analyze the following sales numbers: 100, 150, 120, 180.");
            setBudget("0.05");
            setDemoMode("");
          }}
          className="px-3 py-1 rounded-lg text-xs font-semibold font-mono bg-white/5 border border-white/10 text-amber-400 hover:bg-white/10"
        >
          📊 Sales Analysis
        </button>

        <button
          type="button"
          onClick={() => {
            setTaskType("auto");
            setDescription("What is the current price of a smartphone under ₹30,000?");
            setBudget("0.05");
            setDemoMode("");
          }}
          className="px-3 py-1 rounded-lg text-xs font-semibold font-mono bg-white/5 border border-white/10 text-blue-400 hover:bg-white/10"
        >
          📱 Phone Under ₹30k
        </button>

        <button
          type="button"
          onClick={() => {
            setTaskType("auto");
            setDescription("Calculate the percentage increase from 800 to 1000.");
            setBudget("0.05");
            setDemoMode("");
          }}
          className="px-3 py-1 rounded-lg text-xs font-semibold font-mono bg-white/5 border border-white/10 text-pink-400 hover:bg-white/10"
        >
          🔢 Math Calculation
        </button>
      </div>

      {/* Task Creation Form */}
      <form onSubmit={handleExecuteWorkflow} className="glass-panel p-6 border border-white/10 flex flex-col gap-5">
        {/* Task Type */}
        <div>
          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
            <span>Routing Mode & Specialization</span>
            <span className="text-gray-400 font-normal lowercase text-[11px]">(system auto-selects agent if auto is chosen)</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            {([
              { id: "auto", label: "⚡ AI AUTO-ROUTE", desc: "Intent Classifier" },
              { id: "research", label: "RESEARCH", desc: "Research Agent" },
              { id: "pricing", label: "PRICING", desc: "Pricing Agent" },
              { id: "analysis", label: "ANALYSIS", desc: "Analysis Agent" }
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTaskType(t.id)}
                className={`py-2.5 px-3 rounded-xl font-bold uppercase transition border text-center flex flex-col items-center justify-center gap-0.5 ${
                  taskType === t.id
                    ? "bg-[#00f2fe]/20 text-[#00f2fe] border-[#00f2fe]/50 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                <span>{t.label}</span>
                <span className="text-[10px] font-normal opacity-70">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Task Description */}
        <div>
          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 font-mono">
            Task Description / Prompt
          </label>
          <textarea
            rows={3}
            required
            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm outline-none focus:border-[#00f2fe] transition"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you want the AI agents to accomplish..."
          />
        </div>

        {/* Budget & Demo Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 font-mono">
              Escrow Budget (tMSTC)
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="w-full px-4 py-2.5 pr-16 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm outline-none focus:border-[#00f2fe]"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <span className="absolute right-4 text-xs font-mono text-gray-400 font-bold">tMSTC</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 font-mono">
              Worker Behavior Simulator
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm outline-none focus:border-[#00f2fe]"
              value={demoMode}
              onChange={(e) => setDemoMode(e.target.value)}
            >
              <option value="success">Truthful Agent (Accurate Price)</option>
              <option value="failure">Malicious Agent (Inject Discrepancy / Hallucination)</option>
              <option value="">Dynamic Autonomous Execution</option>
            </select>
          </div>
        </div>

        {/* Preferred Agent (Optional) */}
        <div>
          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 font-mono">
            Preferred Agent <span className="text-gray-500 font-normal lowercase">(Optional: auto-assigned by Orchestrator if unselected)</span>
          </label>
          <select
            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm outline-none focus:border-[#00f2fe]"
            value={preferredAgent}
            onChange={(e) => setPreferredAgent(e.target.value)}
          >
            <option value="">⚡ Auto (Let Orchestrator Decide)</option>
            {availableAgents.map((ag) => (
              <option key={ag.agent_id} value={ag.agent_id}>
                {ag.name} ({ag.agent_id} • {ag.agent_type.toUpperCase()} • Rep: {ag.reputation})
              </option>
            ))}
          </select>
        </div>

        {demoMode === "failure" && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong>Malicious Scenario Active:</strong> The worker agent will report ₹49,999 instead of ₹59,999.
              The isolated Verification Agent will catch this discrepancy, reject payment, refund client escrow, and penalize the agent reputation by -31 points.
            </div>
          </div>
        )}

        {/* Dual Actions: Fund Only vs Fund & Execute Immediately */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={isExecuting || isFundingOnly || !description.trim()}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-sm shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Executing Verifiable Trust Pipeline...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Fund Escrow & Execute Immediately</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleFundOnly}
            disabled={isExecuting || isFundingOnly || !description.trim()}
            className="px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 font-mono"
          >
            {isFundingOnly ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Locking Escrow...</span>
              </>
            ) : (
              <>
                <Lock size={14} className="text-emerald-400" />
                <span>Deposit Escrow Only</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}
      </form>

      {/* Stepper Progress */}
      {isExecuting && (
        <div className="glass-panel p-6 border border-white/10 flex flex-col gap-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#00f2fe] animate-pulse" />
              <span>Live Pipeline Progress</span>
            </div>
            {executionPhase && (
              <span className="text-[11px] text-[#00f2fe] bg-[#00f2fe]/10 px-2.5 py-1 rounded-md border border-[#00f2fe]/30 font-mono">
                {executionPhase}
              </span>
            )}
          </div>

          {[
            { num: 1, title: "Escrow Deposit Locked", desc: "Client locks budget into TaskEscrow smart contract" },
            { num: 2, title: "Agent Dispatched & Computing", desc: "Worker agent executes instructions off-chain" },
            { num: 3, title: "Independent Verification", desc: "Isolated verifier validates output against reference data" },
            { num: 4, title: "Proof of Agent Work Hashed", desc: "Canonical SHA-256 root hash generated" },
            { num: 5, title: "Economic Settlement", desc: "Payment released/refunded & reputation recorded" },
          ].map((st) => (
            <div
              key={st.num}
              className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                stepIndex === st.num
                  ? "bg-[#00f2fe]/10 border-[#00f2fe] text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]"
                  : stepIndex > st.num
                  ? "bg-white/5 border-emerald-500/40 text-emerald-400"
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}
            >
              <div className="w-6 h-6 rounded-full border flex items-center justify-center font-bold">
                {stepIndex > st.num ? "✓" : st.num}
              </div>
              <div>
                <div className="font-bold">{st.title}</div>
                <div className="text-[11px] text-gray-400">{st.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result Inspector */}
      {result && (
        <div className={`glass-panel p-6 border flex flex-col gap-5 ${result.verification?.verified ? "border-emerald-500/40" : "border-rose-500/40"}`}>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {result.verification?.verified ? (
                <CheckCircle2 size={32} className="text-emerald-400" />
              ) : (
                <XCircle size={32} className="text-rose-400" />
              )}
              <div>
                <h3 className="text-lg font-bold text-white">
                  {result.verification?.verified ? "VERIFICATION PASSED — ESCROW RELEASED" : "VERIFICATION FAILED — CLIENT REFUNDED"}
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Task ID: {result.task_id} • Status: {result.status}
                </p>
              </div>
            </div>

            <div className="flex gap-2 font-mono text-xs">
              <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-center">
                <span className="text-gray-500 text-[10px] block">REPUTATION DELTA</span>
                <span className={`font-bold ${result.reputation?.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {result.reputation?.change >= 0 ? `+${result.reputation?.change}` : result.reputation?.change}
                </span>
              </div>
              <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-center">
                <span className="text-gray-500 text-[10px] block">PAYMENT STATUS</span>
                <span className={`font-bold ${result.payment?.status === "PAID" ? "text-emerald-400" : "text-rose-400"}`}>
                  {result.payment?.status}
                </span>
              </div>
            </div>
          </div>

          {/* Orchestrator Intent Understanding & Routing Card */}
          {(result.orchestrator || result.reason) && (
            <div className="bg-black/50 p-4 rounded-xl border border-[#00f2fe]/30 font-mono text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-[#00f2fe] font-bold">
                  <Cpu size={16} />
                  <span>ORCHESTRATOR DYNAMIC ROUTING</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#00f2fe]/20 text-[#00f2fe] text-xs font-bold border border-[#00f2fe]/30">
                    {result.orchestrator?.selected_agent || result.agent?.name}
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    Confidence: {result.orchestrator?.confidence ?? result.confidence ?? 95}%
                  </span>
                </div>
              </div>
              <div className="text-gray-400 text-xs">
                <span className="text-gray-500 font-semibold uppercase">Original Task: </span>
                <span className="text-white font-medium">"{result.task || result.description}"</span>
              </div>
              <div className="text-gray-300 text-xs bg-white/5 p-2.5 rounded-lg border border-white/5">
                <span className="text-[#00f2fe] font-semibold">Routing Rationale: </span>
                {result.orchestrator?.reason || result.reason}
              </div>
            </div>
          )}

          {/* Worker vs Verifier Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-black/40 p-4 rounded-xl border border-white/10">
              <div className="text-gray-400 font-bold mb-2 flex items-center gap-1.5">
                <FileText size={14} className="text-[#00f2fe]" />
                <span>Worker Agent Output ({result.agent?.name})</span>
              </div>
              <div className="text-gray-300 whitespace-pre-wrap">{result.result?.worker_result}</div>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-white/10">
              <div className="text-gray-400 font-bold mb-2 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Isolated Verifier Attestation</span>
              </div>
              <div className="text-gray-300">{result.verification?.reason}</div>
              <div className="text-emerald-400 mt-2 font-bold">
                Confidence: {result.verification?.confidence}%
              </div>
            </div>
          </div>

          {/* Proof Hash Box */}
          <div className="bg-black/50 p-4 rounded-xl border border-white/10 font-mono text-xs">
            <div className="flex items-center gap-2 text-gray-400 font-bold mb-1">
              <Hash size={14} className="text-[#00f2fe]" />
              <span>Canonical Proof Root Hash (SHA-256):</span>
            </div>
            <div className="text-[#00f2fe] font-bold break-all">{result.proof?.proof_hash}</div>
          </div>

          {/* On-chain settlement transaction link */}
          {(result.blockchain_tx_hash || onChainTxHash) && (
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <span className="text-gray-400">On-Chain Settlement Transaction:</span>
              <a
                href={`https://mstscan.com/tx/${result.blockchain_tx_hash || onChainTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#00f2fe] hover:underline flex items-center gap-1 font-bold break-all"
              >
                <span>{(result.blockchain_tx_hash || onChainTxHash)?.slice(0, 18)}...{(result.blockchain_tx_hash || onChainTxHash)?.slice(-8)}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link
              href={`/tasks/${result.task_id}`}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-xs hover:bg-white/10 transition"
            >
              Open Dedicated Task View →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateTaskPage() {
  return (
    <React.Suspense fallback={<div className="max-w-4xl mx-auto px-6 py-16 text-center font-mono text-xs text-gray-400">Loading Task Escrow Creator...</div>}>
      <CreateTaskContent />
    </React.Suspense>
  );
}
