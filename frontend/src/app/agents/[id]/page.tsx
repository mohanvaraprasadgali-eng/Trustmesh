"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  Cpu, 
  ShieldCheck, 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Check, 
  Layers, 
  CheckCircle2, 
  XCircle,
  Clock
} from "lucide-react";

export default function AgentDetailsPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const [agent, setAgent] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!agentId) return;

    const fetchAgentAndTasks = async () => {
      try {
        const [agRes, tkRes, histRes] = await Promise.all([
          fetch(`/api/agents/${agentId}`).catch(() => null),
          fetch("/api/tasks").catch(() => null),
          fetch(`/api/agents/${agentId}/history`).catch(() => null),
        ]);

        if (agRes && agRes.ok) {
          setAgent(await agRes.json());
        }
        if (tkRes && tkRes.ok) {
          const tk = await tkRes.json();
          const allTasks: any[] = tk.tasks || [];
          setTasks(allTasks.filter((t) => t.assigned_agent_id === agentId));
        }
        if (histRes && histRes.ok) {
          const hist = await histRes.json();
          setHistory(hist.history || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentAndTasks();
  }, [agentId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center text-gray-400 font-mono text-xs">
        Loading agent telemetry from mesh...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Agent Not Found</h2>
        <p className="text-gray-400 text-sm mb-6">No agent registered with ID: {agentId}</p>
        <Link href="/agents" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-[#00f2fe]">
          ← Back to Agent Registry
        </Link>
      </div>
    );
  }

  const isVerifier = agent.agent_type === "verification";
  const repColor = agent.reputation >= 80 ? "text-emerald-400" : agent.reputation >= 50 ? "text-amber-400" : "text-rose-400";
  const repFill = agent.reputation >= 80 ? "bg-emerald-500" : agent.reputation >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      <Link href="/agents" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition w-fit">
        <ArrowLeft size={14} />
        <span>Back to Registry</span>
      </Link>

      {/* Main Agent Header Card */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isVerifier ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/20"}`}>
            {isVerifier ? <ShieldCheck size={28} /> : <Cpu size={28} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-purple-400 font-bold uppercase">
                {agent.agent_type}
              </span>
            </div>
            <div className="font-mono text-xs text-gray-400 mt-1 flex items-center gap-2">
              <span>{agent.agent_id}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {agent.wallet_address.slice(0, 10)}...{agent.wallet_address.slice(-6)}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(agent.wallet_address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="hover:text-[#00f2fe]"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Reputation</span>
            <span className={`text-2xl font-extrabold font-mono ${repColor}`}>{agent.reputation}/100</span>
          </div>
          <div className="w-40 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${repFill}`} style={{ width: `${agent.reputation}%` }} />
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
        <div className="glass-panel p-4 border border-white/10 text-center">
          <div className="text-gray-500 uppercase text-[10px]">Tasks Handled</div>
          <div className="text-xl font-extrabold text-white mt-1">{agent.tasks_completed}</div>
        </div>
        <div className="glass-panel p-4 border border-white/10 text-center">
          <div className="text-gray-500 uppercase text-[10px]">Successful Tasks</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{agent.tasks_verified}</div>
        </div>
        <div className="glass-panel p-4 border border-white/10 text-center">
          <div className="text-gray-500 uppercase text-[10px]">Failed Tasks</div>
          <div className="text-xl font-extrabold text-rose-400 mt-1">{Math.max(0, agent.tasks_completed - agent.tasks_verified)}</div>
        </div>
        <div className="glass-panel p-4 border border-white/10 text-center">
          <div className="text-gray-500 uppercase text-[10px]">Verification Rate</div>
          <div className="text-xl font-extrabold text-white mt-1">
            {agent.tasks_completed > 0 ? `${Math.round((agent.tasks_verified / agent.tasks_completed) * 100)}%` : "100%"}
          </div>
        </div>
        <div className="glass-panel p-4 border border-white/10 text-center col-span-2 sm:col-span-1">
          <div className="text-gray-500 uppercase text-[10px]">Status</div>
          <div className={`text-xl font-extrabold mt-1 ${agent.status === "ACTIVE" ? "text-emerald-400" : "text-rose-400"}`}>
            {agent.status}
          </div>
        </div>
      </div>

      {/* Task History by this Agent */}
      <div className="glass-panel p-6 border border-white/10">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Layers size={18} className="text-[#00f2fe]" />
          <span>Execution & Verification History ({tasks.length})</span>
        </h3>

        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs font-mono">
            No tasks completed yet by this agent. Dispatch tasks to this agent from the Create Task page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-gray-400 border-b border-white/10 pb-2 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Task ID</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Budget</th>
                  <th className="py-2.5 px-3">Verification</th>
                  <th className="py-2.5 px-3">Proof Hash</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tasks.map((task) => (
                  <tr key={task.task_id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3 font-bold text-white">{task.task_id}</td>
                    <td className="py-3 px-3 text-gray-300 max-w-xs truncate">{task.description}</td>
                    <td className="py-3 px-3 text-emerald-400 font-semibold">{task.budget} tMSTC</td>
                    <td className="py-3 px-3">
                      {task.verified ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> PASS
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <XCircle size={12} /> FAIL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {task.proof_hash ? `${task.proof_hash.slice(0, 10)}...` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link href={`/tasks/${task.task_id}`} className="text-[#00f2fe] hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chronological Reputation Audit Log */}
      <div className="glass-panel p-6 border border-white/10">
        <h3 className="text-base font-bold text-white mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-emerald-400" />
            <span>Reputation Ledger & Slashing Audit Log ({history.length})</span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">Rules: +2 Pass | -31 Fraud Slash</span>
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs font-mono">
            No reputation events logged yet for this agent.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-gray-400 border-b border-white/10 pb-2 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Delta</th>
                  <th className="py-2.5 px-3">Score Shift</th>
                  <th className="py-2.5 px-3">Task ID</th>
                  <th className="py-2.5 px-3">Reason / Invariant Attestation</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        ev.delta >= 0
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}>
                        {ev.delta >= 0 ? `+${ev.delta}` : ev.delta}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white font-bold">
                      {ev.reputation_before} → {ev.reputation_after}
                    </td>
                    <td className="py-3 px-3 text-gray-300">
                      <Link href={`/tasks/${ev.task_id}`} className="hover:text-[#00f2fe] underline">
                        {ev.task_id}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-gray-300 max-w-sm truncate" title={ev.reason}>
                      {ev.reason}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-400">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "—"}
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

