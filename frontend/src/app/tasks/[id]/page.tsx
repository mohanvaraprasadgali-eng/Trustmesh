"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Hash, 
  FileText, 
  ShieldCheck, 
  Coins, 
  ExternalLink,
  Copy,
  Check,
  Clock,
  ArrowRight,
  Lock,
  Unlock,
  AlertTriangle,
  Layers,
  Sparkles,
  Loader2
} from "lucide-react";

export default function TaskDetailsPage() {
  const params = useParams();
  const taskId = params?.id as string;
  const [task, setTask] = useState<any>(null);
  const [proof, setProof] = useState<any>(null);
  const [onChainRecord, setOnChainRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showCanonical, setShowCanonical] = useState(false);

  const fetchTaskData = async () => {
    try {
      const [tRes, pRes, bRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`).catch(() => null),
        fetch(`/api/tasks/${taskId}/proof`).catch(() => null),
        fetch(`/api/blockchain/tasks/${taskId}`).catch(() => null),
      ]);

      if (tRes && tRes.ok) setTask(await tRes.json());
      if (pRes && pRes.ok) setProof(await pRes.json());
      if (bRes && bRes.ok) {
        const bData = await bRes.json();
        if (bData.recorded_on_chain) setOnChainRecord(bData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!taskId) return;
    fetchTaskData();
  }, [taskId]);

  const handleDispatch = async () => {
    setIsDispatching(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/execute`, { method: "POST" });
      if (res.ok) {
        await fetchTaskData();
      }
    } catch (e) {
      console.error("Execution failed:", e);
    } finally {
      setIsDispatching(false);
    }
  };

  const copyText = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-[#00f2fe]" size={28} />
        <span className="text-gray-400 font-mono text-xs">
          Loading task record from database & blockchain...
        </span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Task Record Not Found</h2>
        <p className="text-gray-400 text-sm mb-6">No task recorded with ID: {taskId}</p>
        <Link href="/tasks" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-[#00f2fe]">
          ← Back to Tasks
        </Link>
      </div>
    );
  }

  const isVerified = task.verified;
  const isSettled = task.status === "COMPLETED" || task.status === "FAILED";
  const isRefunded = task.payment_status === "REFUNDED";
  const isPaid = task.payment_status === "PAID";

  // 5-Step Lifecycle Definitions
  const steps = [
    {
      num: 1,
      name: "Escrow Funded",
      desc: `${task.budget} tMSTC locked`,
      status: "completed",
      icon: Lock,
    },
    {
      num: 2,
      name: "Agent Dispatched",
      desc: task.status === "CREATED" ? "Awaiting worker" : "Analysis completed",
      status: task.status === "CREATED" ? "current" : "completed",
      icon: Sparkles,
    },
    {
      num: 3,
      name: "Independent Verification",
      desc: task.verified === null ? "Pending check" : task.verified ? "Attested within 5%" : "Tolerance exceeded",
      status: task.verified === null ? (task.status === "CREATED" ? "pending" : "current") : "completed",
      icon: ShieldCheck,
      failed: task.verified === false,
    },
    {
      num: 4,
      name: "Proof of Work Root",
      desc: task.proof_hash ? "SHA-256 anchored" : "Pending root hash",
      status: task.proof_hash ? "completed" : "pending",
      icon: Hash,
    },
    {
      num: 5,
      name: isRefunded ? "Escrow Refunded" : isPaid ? "Escrow Released" : "Settlement",
      desc: isRefunded ? "Client reimbursed (-31 Rep)" : isPaid ? "Worker rewarded (+2 Rep)" : "Pending resolution",
      status: isSettled ? "completed" : "pending",
      icon: isRefunded ? AlertTriangle : Coins,
      failed: isRefunded,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <Link href="/tasks" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition w-fit">
        <ArrowLeft size={14} />
        <span>Back to Tasks</span>
      </Link>

      {/* Task Summary Card */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-purple-400 uppercase font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                {task.task_type}
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isVerified ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : isVerified === false ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                {isVerified ? "VERIFIED" : isVerified === false ? "VERIFICATION FAILED" : "PENDING"}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                STATUS: {task.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white font-mono mt-2">{task.task_id}</h1>
            <p className="text-sm text-gray-300 mt-2">{task.description}</p>
          </div>

          <div className="flex flex-col items-end gap-1.5 font-mono text-xs">
            <span className="text-gray-500 text-[10px]">ESCROW BUDGET</span>
            <span className="text-lg font-extrabold text-emerald-400">{task.budget} tMSTC</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPaid ? "bg-emerald-500/20 text-emerald-400" : isRefunded ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"}`}>
              SETTLEMENT: {task.payment_status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/40 p-3 rounded-xl border border-white/5 font-mono text-xs text-center mt-2">
          <div>
            <div className="text-gray-500 text-[10px]">Assigned Agent</div>
            <div className="text-white font-bold mt-0.5">{task.assigned_agent_id || "Unassigned"}</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px]">Created At</div>
            <div className="text-gray-300 mt-0.5">{task.created_at ? new Date(task.created_at).toLocaleTimeString() : "—"}</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px]">Completed At</div>
            <div className="text-gray-300 mt-0.5">{task.completed_at ? new Date(task.completed_at).toLocaleTimeString() : "—"}</div>
          </div>
          <div>
            <div className="text-gray-500 text-[10px]">Reputation Delta</div>
            <div className={`font-bold mt-0.5 ${task.reputation_after > task.reputation_before ? "text-emerald-400" : task.reputation_after < task.reputation_before ? "text-rose-400" : "text-gray-400"}`}>
              {task.reputation_before !== null && task.reputation_after !== null ? `${task.reputation_before} → ${task.reputation_after}` : "Pending"}
            </div>
          </div>
        </div>

        {task.status === "CREATED" && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between flex-wrap gap-3 mt-1">
            <div>
              <div className="text-white font-bold text-xs">Task Pending Execution</div>
              <div className="text-gray-400 text-[11px] font-mono">Funds are reserved in escrow. Ready for agent dispatch and verification.</div>
            </div>
            <button
              onClick={handleDispatch}
              disabled={isDispatching}
              className="px-4 py-2 rounded-xl bg-[#00f2fe] text-[#070a13] font-bold text-xs hover:bg-[#00f2fe]/90 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isDispatching && <Loader2 size={14} className="animate-spin" />}
              <span>{isDispatching ? "Executing & Verifying..." : "Dispatch Agent & Verify Now"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Escrow Lifecycle State Machine Stepper */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#00f2fe]" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Escrow Lifecycle State Machine
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
            {isSettled ? (isVerified ? "SETTLED: RELEASED" : "SETTLED: REFUNDED") : "PIPELINE ACTIVE"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";
            const isFailed = step.failed;

            return (
              <div
                key={step.num}
                className={`p-3 rounded-xl border flex flex-col gap-2 relative transition-all ${
                  isFailed
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : isCurrent
                    ? "bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                    : "bg-black/30 border-white/5 text-gray-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isFailed ? "bg-rose-500/20 text-rose-400" : isCompleted ? "bg-emerald-500/20 text-emerald-400" : isCurrent ? "bg-purple-500/20 text-purple-300" : "bg-white/5 text-gray-500"
                  }`}>
                    0{step.num}
                  </span>
                  <Icon size={14} className={isFailed ? "text-rose-400" : isCompleted ? "text-emerald-400" : isCurrent ? "text-purple-400 animate-pulse" : "text-gray-600"} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white font-mono leading-tight">{step.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono mt-1 leading-snug">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* On-Chain Record (MST Blockchain TaskEscrow.sol) */}
      {onChainRecord && onChainRecord.task && (
        <div className="glass-panel p-6 border border-emerald-500/30 bg-black/40 font-mono text-xs flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Coins size={16} className="text-emerald-400" />
              <span>MST Blockchain On-Chain Task Record (TaskEscrow.sol)</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
              MST TESTNET CONFIRMED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/50 p-3 rounded-xl border border-white/5">
            <div>
              <div className="text-gray-500 text-[10px]">On-Chain Status</div>
              <div className="text-white font-bold mt-0.5">{onChainRecord.task.status}</div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">On-Chain Escrow Amount</div>
              <div className="text-emerald-400 font-bold mt-0.5">{onChainRecord.task.amount_mstc} tMSTC</div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Verification Result</div>
              <div className="text-white font-bold mt-0.5">{onChainRecord.task.verified ? "VERIFIED" : "UNVERIFIED"}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 text-[11px]">
            <div>
              <span className="text-gray-500">Contract Address: </span>
              <span className="text-gray-300 break-all">{onChainRecord.contract_address}</span>
            </div>
            <div>
              <span className="text-gray-500">Client Address: </span>
              <span className="text-gray-300 break-all">{onChainRecord.task.client}</span>
            </div>
            {onChainRecord.task.proof_hash && (
              <div>
                <span className="text-gray-500">On-Chain Proof Root Hash: </span>
                <span className="text-[#00f2fe] break-all">{onChainRecord.task.proof_hash}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="glass-panel p-5 border border-white/10">
          <div className="flex items-center gap-1.5 text-gray-400 font-bold mb-3">
            <FileText size={15} className="text-[#00f2fe]" />
            <span>Worker Agent Raw Output</span>
          </div>
          <div className="bg-black/50 p-3.5 rounded-xl border border-white/5 text-gray-200 leading-relaxed whitespace-pre-wrap">
            {task.agent_result || "No execution result recorded yet."}
          </div>
        </div>

        <div className="glass-panel p-5 border border-white/10">
          <div className="flex items-center gap-1.5 text-gray-400 font-bold mb-3">
            <ShieldCheck size={15} className="text-emerald-400" />
            <span>Independent Verification Attestation</span>
          </div>
          <div className="bg-black/50 p-3.5 rounded-xl border border-white/5 text-gray-200 leading-relaxed">
            <div className="font-semibold text-white mb-2">{task.verification_reason || "Verification pending."}</div>
            {task.verification_confidence && (
              <div className="text-emerald-400 text-xs mt-2">
                Attestation Confidence: {task.verification_confidence}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proof of Agent Work Commitment */}
      <div className="glass-panel p-6 border border-[#00f2fe]/30 bg-black/40 font-mono text-xs flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Hash size={16} className="text-[#00f2fe]" />
            <span>Cryptographic Proof of Agent Work (PoAW)</span>
          </div>

          {proof?.integrity_verified && (
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> CANONICAL SHA-256 VERIFIED
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <div className="text-gray-500 text-[10px]">CANONICAL PROOF ROOT HASH (SHA-256)</div>
            <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-lg border border-white/10 mt-1">
              <span className="text-[#00f2fe] font-bold break-all">{task.proof_hash || "Off-chain proof pending"}</span>
              {task.proof_hash && (
                <button onClick={() => copyText(task.proof_hash, "proof")} className="text-gray-400 hover:text-white ml-2">
                  {copiedHash === "proof" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="text-gray-500 text-[10px]">WORKER RESULT HASH</div>
            <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-lg border border-white/10 mt-1">
              <span className="text-gray-300 break-all">{task.result_hash || "—"}</span>
              {task.result_hash && (
                <button onClick={() => copyText(task.result_hash, "result")} className="text-gray-400 hover:text-white ml-2">
                  {copiedHash === "result" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>

          {proof?.verification_hash && (
            <div>
              <div className="text-gray-500 text-[10px]">VERIFICATION OUTCOME HASH</div>
              <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-lg border border-white/10 mt-1">
                <span className="text-gray-300 break-all">{proof.verification_hash}</span>
                <button onClick={() => copyText(proof.verification_hash, "verif")} className="text-gray-400 hover:text-white ml-2">
                  {copiedHash === "verif" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Canonical Proof Structure Toggle */}
        {proof?.canonical_proof && (
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-[11px]">CANONICAL JSON PAYLOAD (GROUND TRUTH)</span>
              <button
                onClick={() => setShowCanonical(!showCanonical)}
                className="text-[#00f2fe] text-[11px] hover:underline"
              >
                {showCanonical ? "Hide JSON" : "View JSON Payload"}
              </button>
            </div>
            {showCanonical && (
              <pre className="p-3 rounded-lg bg-black/80 border border-white/10 text-gray-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(proof.canonical_proof, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          {task.blockchain_tx_hash ? (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">On-Chain Transaction:</span>
              <a
                href={`https://mstscan.com/tx/${task.blockchain_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00f2fe] flex items-center gap-1 hover:underline font-mono"
              >
                <span>{task.blockchain_tx_hash.slice(0, 16)}...</span>
                <ExternalLink size={12} />
              </a>
            </div>
          ) : (
            <span className="text-gray-500 font-mono text-[11px]">Local Demo / Off-Chain Proof</span>
          )}

          <Link
            href="/verification"
            className="text-xs text-[#00f2fe] hover:underline flex items-center gap-1"
          >
            <span>Re-verify in Verification Center</span>
            <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
