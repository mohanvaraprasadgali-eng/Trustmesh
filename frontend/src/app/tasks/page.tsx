"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Layers, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ArrowRight,
  Filter
} from "lucide-react";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchTasks = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter || t.payment_status === statusFilter;
    const matchesSearch =
      t.task_id.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.assigned_agent_id && t.assigned_agent_id.toLowerCase().includes(search.toLowerCase())) ||
      (t.proof_hash && t.proof_hash.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Layers className="text-[#00f2fe]" size={28} />
            <span>Task Escrow & Execution Ledger</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Historical record of task creation, escrow deposits, independent verifications, and settlement states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTasks}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-[#00f2fe]" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
          </button>

          <Link
            href="/tasks/create"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-xs shadow-[0_0_15px_rgba(0,242,254,0.3)] hover:scale-[1.02] transition"
          >
            <PlusCircle size={15} />
            <span>Create New Task</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-[#00f2fe] font-mono transition"
            placeholder="Search by ID, prompt, agent, or proof..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
          {["ALL", "PAID", "REFUNDED", "CREATED", "VERIFIED", "FAILED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === s
                  ? "bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/40"
                  : "text-gray-400 hover:text-white bg-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="glass-panel p-6 border border-white/10">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs font-mono">
            No matching tasks found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-gray-400 border-b border-white/10 pb-2 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Task ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Agent</th>
                  <th className="py-2.5 px-3">Escrow Budget</th>
                  <th className="py-2.5 px-3">Verification</th>
                  <th className="py-2.5 px-3">Settlement</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTasks.map((task) => (
                  <tr key={task.task_id} className="hover:bg-white/5 transition">
                    <td className="py-3.5 px-3 font-bold text-white">{task.task_id}</td>
                    <td className="py-3.5 px-3 uppercase text-purple-400">{task.task_type}</td>
                    <td className="py-3.5 px-3 text-gray-300 max-w-xs truncate">{task.description}</td>
                    <td className="py-3.5 px-3 text-gray-400">{task.assigned_agent_id || "Orchestrator"}</td>
                    <td className="py-3.5 px-3 font-semibold text-emerald-400">{task.budget} tMSTC</td>
                    <td className="py-3.5 px-3">
                      {task.verified === true && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} /> PASSED
                        </span>
                      )}
                      {task.verified === false && (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <XCircle size={13} /> SLASHED
                        </span>
                      )}
                      {task.verified === null && <span className="text-amber-400 font-semibold">PENDING</span>}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${task.payment_status === "PAID" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : task.payment_status === "BLOCKED" || task.payment_status === "REFUNDED" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                        {task.payment_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <Link
                        href={`/tasks/${task.task_id}`}
                        className="text-[#00f2fe] font-semibold hover:underline"
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
