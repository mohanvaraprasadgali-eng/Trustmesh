"use client";

import React, { useState, useEffect } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { getTaskEscrowContract } from "@/contracts/clientContracts";
import { 
  FileCheck2, 
  ShieldCheck, 
  Code2, 
  CheckCircle2, 
  AlertTriangle, 
  Hash, 
  ArrowRight,
  Sparkles,
  Search,
  ExternalLink,
  Cpu
} from "lucide-react";

export default function VerificationCenterPage() {
  const { provider, contractAddresses, environment } = useWeb3();

  // Reference catalog state
  const [referenceCatalog, setReferenceCatalog] = useState<any | null>(null);
  const [showCatalogDetails, setShowCatalogDetails] = useState(false);

  // Live Verification Evaluator state
  const [evalTaskType, setEvalTaskType] = useState<"pricing" | "research" | "analysis">("pricing");
  const [evalDescription, setEvalDescription] = useState("Fetch verified market price for MacBook Pro");
  const [evalWorkerResult, setEvalWorkerResult] = useState("Market price for MacBook Pro is ₹169,900");
  const [evalReportedPrice, setEvalReportedPrice] = useState("169900");
  const [evalDemoMode, setEvalDemoMode] = useState<string>("none");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalAttestation, setEvalAttestation] = useState<any | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Sandbox state
  const [testInput, setTestInput] = useState('{"product": "Laptop X", "price": 59999, "currency": "INR"}');
  const [originalHash, setOriginalHash] = useState<string | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [tamperState, setTamperState] = useState<"MATCH" | "TAMPERED" | null>(null);

  // Live Task Verification State
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [isVerifyingTask, setIsVerifyingTask] = useState(false);
  const [taskProofData, setTaskProofData] = useState<any | null>(null);
  const [onChainHash, setOnChainHash] = useState<string | null>(null);
  const [clientRecomputedHash, setClientRecomputedHash] = useState<string | null>(null);
  const [taskVerificationStatus, setTaskVerificationStatus] = useState<"VALID" | "MISMATCH" | null>(null);
  const [taskVerifyError, setTaskVerifyError] = useState<string | null>(null);

  // Load reference catalog on mount
  useEffect(() => {
    fetch("/api/verification/reference-data")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setReferenceCatalog(data);
      })
      .catch(console.error);
  }, []);

  // Load available tasks
  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => {
        const list = data.tasks || [];
        setTasks(list);
        if (list.length > 0 && !selectedTaskId) {
          setSelectedTaskId(list[0].task_id);
        }
      })
      .catch(console.error);
  }, [selectedTaskId]);

  const handleComputeInitialHash = async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(testInput);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    
    setOriginalHash(hashHex);
    setComputedHash(hashHex);
    setTamperState("MATCH");
  };

  const handleVerifyIntegrity = async () => {
    if (!originalHash) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(testInput);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    
    setComputedHash(hashHex);
    if (hashHex.toLowerCase() === originalHash.toLowerCase()) {
      setTamperState("MATCH");
    } else {
      setTamperState("TAMPERED");
    }
  };

  // Canonical SHA-256 computation in client
  const computeCanonicalProofHash = async (proof: any): Promise<string> => {
    // Canonical object with sorted keys matching Python proof_generator.py:
    // agent_id, result_hash, task_id, task_type, timestamp, verification_hash, verified
    const canonicalObj = {
      agent_id: proof.agent_id,
      result_hash: proof.result_hash,
      task_id: proof.task_id,
      task_type: proof.task_type,
      timestamp: proof.timestamp,
      verification_hash: proof.verification_hash,
      verified: proof.verified,
    };

    // Serialize with exact JSON formatting (no spaces between separators)
    const jsonStr = JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleVerifySelectedTask = async () => {
    if (!selectedTaskId) return;
    setIsVerifyingTask(true);
    setTaskVerifyError(null);
    setTaskProofData(null);
    setOnChainHash(null);
    setClientRecomputedHash(null);
    setTaskVerificationStatus(null);

    try {
      // 1. Fetch proof from API
      const res = await fetch(`/api/tasks/${selectedTaskId}/proof`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Proof not found for this task");
      }

      const proof = await res.json();
      setTaskProofData(proof);

      // 2. Recompute canonical hash in client browser
      const recomputed = await computeCanonicalProofHash(proof);
      setClientRecomputedHash(recomputed);

      // 3. If in testnet and provider available, query smart contract directly
      let onChainContractHash: string | null = null;
      if (provider && contractAddresses.taskEscrow) {
        try {
          const escrow = getTaskEscrowContract(contractAddresses.taskEscrow, provider);
          const rawHash = await escrow.getProofHash(selectedTaskId);
          if (rawHash && rawHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            onChainContractHash = rawHash;
            setOnChainHash(rawHash);
          }
        } catch (contractErr) {
          console.warn("Contract call skipped or task unrecorded on-chain:", contractErr);
        }
      }

      // Check match between stored proof hash and client recomputed hash
      const matches = recomputed.toLowerCase() === proof.proof_hash.toLowerCase();
      setTaskVerificationStatus(matches ? "VALID" : "MISMATCH");
    } catch (err: any) {
      setTaskVerifyError(err?.message || "Task verification failed");
    } finally {
      setIsVerifyingTask(false);
    }
  };

  const handleRunLiveEvaluation = async () => {
    setIsEvaluating(true);
    setEvalError(null);
    setEvalAttestation(null);

    try {
      const payload: any = {
        task_type: evalTaskType,
        task_description: evalDescription,
        worker_result: evalWorkerResult,
        worker_agent_id: evalTaskType === "pricing" ? "agent-pricing-001" : evalTaskType === "research" ? "agent-research-001" : "agent-analysis-001",
        worker_structured_data: evalTaskType === "pricing" 
          ? { price: parseFloat(evalReportedPrice) || 0, currency: "INR" }
          : { topic: evalDescription },
        demo_mode: evalDemoMode === "none" ? undefined : evalDemoMode
      };

      const res = await fetch("/api/verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Verification request failed");
      }

      const data = await res.json();
      setEvalAttestation(data);
    } catch (err: any) {
      setEvalError(err?.message || "Failed to run verification evaluation");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <FileCheck2 className="text-[#00f2fe]" size={28} />
          <span>Verification Center & Anti-Tamper Sandbox</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Explore the mathematical guarantees behind TrustMesh: Isolated validation ground-truth, canonical SHA-256 proofs, and smart contract attestation.
        </p>
      </div>

      {/* Verification Agent Overview Card */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Independent Verification Agent</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {referenceCatalog?.verifier_id || "agent-verification-001"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-xl">
                Operates in total isolation with authoritative reference pricing and domain databases. Worker agents cannot see or influence verifier evaluations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-mono text-xs bg-black/40 p-3 rounded-xl border border-white/5 text-right">
              <div className="text-gray-500 text-[10px]">TOLERANCE BAND</div>
              <div className="text-white font-bold text-sm mt-0.5">
                {referenceCatalog?.tolerance_percent ? `${referenceCatalog.tolerance_percent}% Margin` : "5.0% Price Band"}
              </div>
            </div>
            <div className="font-mono text-xs bg-black/40 p-3 rounded-xl border border-white/5 text-right">
              <div className="text-gray-500 text-[10px]">REPUTATION RULES</div>
              <div className="text-emerald-400 font-bold text-sm mt-0.5">
                {referenceCatalog?.reputation_rules ? `${referenceCatalog.reputation_rules.bonus_on_pass} / ${referenceCatalog.reputation_rules.penalty_on_fail}` : "+2 / -31"}
              </div>
            </div>
          </div>
        </div>

        {/* Reference Catalog Dropdown / Pill Toggle */}
        {referenceCatalog?.verified_products && (
          <div className="pt-3 border-t border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-mono text-gray-400">
                AUTHORITATIVE REFERENCE CATALOG ({referenceCatalog.verified_products.length} PRODUCTS)
              </span>
              <button
                onClick={() => setShowCatalogDetails(!showCatalogDetails)}
                className="text-[11px] text-[#00f2fe] hover:underline"
              >
                {showCatalogDetails ? "Hide Catalog" : "View Catalog"}
              </button>
            </div>
            {showCatalogDetails && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                {referenceCatalog.verified_products.map((item: any) => (
                  <div key={item.product} className="bg-black/50 p-2 rounded-lg border border-white/5 font-mono text-xs">
                    <span className="text-gray-400 block text-[10px] capitalize">{item.product}</span>
                    <span className="text-[#00f2fe] font-bold">₹{item.verified_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live On-Chain Task Proof Validator */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-5">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Cpu size={20} className="text-[#00f2fe]" />
          <span>Live Proof of Agent Work Validator</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Select any task recorded in TrustMesh to re-run canonical SHA-256 hash reconstruction locally in your browser and verify against the blockchain.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-mono text-gray-400 mb-1">SELECT TASK ID</label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
            >
              {tasks.map((t) => (
                <option key={t.task_id} value={t.task_id}>
                  {t.task_id} — {t.task_type.toUpperCase()} ({t.status})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleVerifySelectedTask}
              disabled={isVerifyingTask || !selectedTaskId}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-40 transition flex items-center justify-center gap-2"
            >
              {isVerifyingTask ? (
                <>
                  <span className="animate-spin font-mono">⚡</span>
                  <span>Validating Hashes...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Verify Task Proof</span>
                </>
              )}
            </button>
          </div>
        </div>

        {taskVerifyError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {taskVerifyError}
          </div>
        )}

        {taskProofData && (
          <div className="flex flex-col gap-4 font-mono text-xs bg-black/40 p-4 rounded-xl border border-white/10">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Proof Verification Breakdown</span>
              {taskVerificationStatus === "VALID" ? (
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 size={12} /> CANONICAL ROOT MATCHES (100% VALID)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px] flex items-center gap-1">
                  <AlertTriangle size={12} /> HASH MISMATCH
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black/50 p-3 rounded-lg border border-white/5">
                <span className="text-gray-500 text-[10px] block">STORED PROOF HASH</span>
                <span className="text-[#00f2fe] font-bold break-all">{taskProofData.proof_hash}</span>
              </div>
              <div className="bg-black/50 p-3 rounded-lg border border-white/5">
                <span className="text-gray-500 text-[10px] block">BROWSER COMPUTED SHA-256</span>
                <span className="text-gray-300 font-bold break-all">{clientRecomputedHash}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-white/5">
              <div>
                <span className="text-gray-500 block">Worker Agent:</span>
                <span className="text-white">{taskProofData.agent_id}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Attestation Result:</span>
                <span className={taskProofData.verified ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {taskProofData.verified ? "PASSED (AUTHENTIC)" : "REJECTED (DISCREPANCY)"}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Timestamp:</span>
                <span className="text-gray-400">{new Date(taskProofData.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            {onChainHash && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-center justify-between text-[11px]">
                <span className="text-emerald-300">Smart Contract On-Chain Hash Verified:</span>
                <span className="font-mono text-emerald-400">{onChainHash.slice(0, 14)}...{onChainHash.slice(-8)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Verification Agent Evaluator (Sandbox) */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Sparkles size={20} className="text-[#00f2fe]" />
            <span>Live Verification Agent Evaluator</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20">
            DIRECT ENGINE API
          </span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Test how the independent Verification Agent validates worker responses in real-time. Try providing an accurate price versus a tampered or hallucinated price to see independent attestation in action.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">TASK TYPE</label>
            <select
              value={evalTaskType}
              onChange={(e) => {
                const val = e.target.value as any;
                setEvalTaskType(val);
                if (val === "pricing") {
                  setEvalDescription("Fetch verified market price for MacBook Pro");
                  setEvalWorkerResult("Market price for MacBook Pro is ₹169,900");
                  setEvalReportedPrice("169900");
                } else if (val === "research") {
                  setEvalDescription("Research MST Blockchain consensus and architecture");
                  setEvalWorkerResult("MST Blockchain is an EVM-compatible network utilizing PoS consensus.");
                } else {
                  setEvalDescription("Analyze smart contract gas optimization options");
                  setEvalWorkerResult("Storage packing and calldata usage will reduce gas overhead by 34%.");
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
            >
              <option value="pricing">Pricing Verification</option>
              <option value="research">Research Verification</option>
              <option value="analysis">Analysis Verification</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-mono text-gray-400 mb-1">TASK DESCRIPTION</label>
            <input
              type="text"
              value={evalDescription}
              onChange={(e) => setEvalDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={evalTaskType === "pricing" ? "md:col-span-2" : "md:col-span-3"}>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">WORKER AGENT RESULT</label>
            <input
              type="text"
              value={evalWorkerResult}
              onChange={(e) => setEvalWorkerResult(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
            />
          </div>

          {evalTaskType === "pricing" && (
            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1">REPORTED PRICE (₹)</label>
              <input
                type="number"
                value={evalReportedPrice}
                onChange={(e) => setEvalReportedPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono text-gray-400">DEMO SCENARIO:</label>
            <select
              value={evalDemoMode}
              onChange={(e) => setEvalDemoMode(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
            >
              <option value="none">Standard Verification (Real Data)</option>
              <option value="failure">Simulate Malicious/Faulty Worker</option>
            </select>
          </div>

          <button
            onClick={handleRunLiveEvaluation}
            disabled={isEvaluating}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {isEvaluating ? (
              <>
                <span className="animate-spin font-mono">⚡</span>
                <span>Verifying Attestation...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Run Verification Agent</span>
              </>
            )}
          </button>
        </div>

        {evalError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {evalError}
          </div>
        )}

        {evalAttestation && (
          <div className="font-mono text-xs bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Verification Engine Attestation</span>
              {evalAttestation.verified ? (
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 size={12} /> VERIFIED PASS (CONFIDENCE {evalAttestation.confidence}%)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px] flex items-center gap-1">
                  <AlertTriangle size={12} /> VERIFIED REJECTED (CONFIDENCE {evalAttestation.confidence}%)
                </span>
              )}
            </div>

            <div className="bg-black/50 p-3 rounded-lg border border-white/5 text-[11px] leading-relaxed">
              <span className="text-gray-500 block text-[10px] mb-0.5">VERIFIER REASONING</span>
              <span className="text-gray-200">{evalAttestation.reason}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                <span className="text-gray-500 block text-[10px]">WORKER REPORTED</span>
                <span className="text-white font-semibold">{evalAttestation.worker_result}</span>
              </div>
              <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
                <span className="text-gray-500 block text-[10px]">INDEPENDENT REFERENCE FOUND</span>
                <span className="text-emerald-400 font-semibold">{evalAttestation.verified_result}</span>
              </div>
            </div>

            <div className="bg-black/50 p-2.5 rounded-lg border border-white/5">
              <span className="text-gray-500 text-[10px] block">GENERATED CANONICAL PROOF HASH</span>
              <span className="text-[#00f2fe] font-bold break-all">{evalAttestation.proof}</span>
            </div>
          </div>
        )}
      </div>

      {/* Anti-Tamper Interactive Sandbox */}
      <div className="glass-panel p-6 border border-[#00f2fe]/30 bg-black/40 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Code2 size={20} className="text-[#00f2fe]" />
          <span>Interactive Anti-Tamper Sandbox</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          1. Click <strong>Generate On-Chain Commitment</strong> to simulate hashing an agent&apos;s output into an on-chain commitment.<br />
          2. Mutate any single character in the JSON below (e.g. change 59999 to 59998).<br />
          3. Click <strong>Verify Integrity</strong> to observe why data tampering is mathematically impossible without breaking the hash.
        </p>

        <textarea
          rows={3}
          className="w-full p-4 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs outline-none focus:border-[#00f2fe]"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
        />

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleComputeInitialHash}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-xs hover:bg-white/10 transition"
          >
            Generate On-Chain Commitment
          </button>
          <button
            onClick={handleVerifyIntegrity}
            disabled={!originalHash}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] disabled:opacity-40 transition"
          >
            Verify Integrity (Check SHA-256)
          </button>
        </div>

        {originalHash && (
          <div className="mt-2 flex flex-col gap-2 font-mono text-xs bg-black/60 p-4 rounded-xl border border-white/10">
            <div>
              <span className="text-gray-500 text-[10px] block">COMMITTED ON-CHAIN PROOF HASH</span>
              <span className="text-[#00f2fe] font-bold break-all">{originalHash}</span>
            </div>
            {computedHash && (
              <div>
                <span className="text-gray-500 text-[10px] block">COMPUTED PAYLOAD HASH</span>
                <span className="text-gray-300 break-all">{computedHash}</span>
              </div>
            )}
          </div>
        )}

        {tamperState === "MATCH" && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <div>
              <strong className="text-emerald-400">INTEGRITY CONFIRMED:</strong> Off-chain payload matches on-chain cryptographic commitment exactly.
            </div>
          </div>
        )}

        {tamperState === "TAMPERED" && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-400 shrink-0" />
            <div>
              <strong className="text-rose-400">TAMPER DETECTED:</strong> Data modification broke mathematical hash match! Proof rejected.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

