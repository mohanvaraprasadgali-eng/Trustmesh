import Link from "next/link";
import { 
  Shield, 
  ArrowRight, 
  Cpu, 
  Lock, 
  FileCheck2, 
  Scale, 
  CheckCircle2, 
  Coins, 
  Layers,
  Sparkles,
  ExternalLink
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-6xl mx-auto px-6 pt-20 pb-16 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles size={13} />
          <span>MST Blockchain AI & Web3 Hackathon</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight mb-4">
          Trust the Agent. <br />
          <span className="bg-gradient-to-r from-[#00f2fe] via-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Verify the Work.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          An AI-agent trust infrastructure combining independent verification, 
          cryptographic Proof of Agent Work, asymmetric reputation, and blockchain-based escrow settlement on MST Blockchain.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#0284c7] text-[#070a13] font-bold text-base shadow-[0_0_25px_rgba(0,242,254,0.3)] hover:shadow-[0_0_35px_rgba(0,242,254,0.5)] hover:scale-[1.02] transition"
          >
            <span>Launch Dashboard</span>
            <ArrowRight size={18} />
          </Link>

          <Link
            href="/tasks/create"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-base hover:bg-white/10 hover:border-white/25 transition"
          >
            <Coins size={18} className="text-[#00f2fe]" />
            <span>Create Task Escrow</span>
          </Link>

          <a
            href="#architecture"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-semibold text-base hover:text-white hover:bg-white/10 transition"
          >
            <Layers size={18} />
            <span>View Architecture</span>
          </a>
        </div>
      </section>

      {/* Trust Pillars Grid */}
      <section className="w-full max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border border-white/10 flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#00f2fe]/10 border border-[#00f2fe]/20 flex items-center justify-center text-[#00f2fe]">
              <FileCheck2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Independent Verification</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Worker outputs are independently validated by an isolated Verification Agent holding authoritative reference datasets before settlement.
            </p>
          </div>

          <div className="glass-panel p-6 border border-white/10 flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Lock size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Proof of Agent Work (PoAW)</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Deterministic SHA-256 canonical hashing links worker computation to independent attestation, committing an immutable 32-byte hash on MST Blockchain.
            </p>
          </div>

          <div className="glass-panel p-6 border border-white/10 flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Scale size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Asymmetric Reputation (+2 / -31)</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Economic game theory makes hallucination or fraud mathematically suicidal: 16 flawless tasks are required to recover from a single dishonest report.
            </p>
          </div>
        </div>
      </section>

      {/* Architecture Visual Pipeline */}
      <section id="architecture" className="w-full max-w-6xl mx-auto px-6 py-16">
        <div className="glass-panel p-8 border border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              End-to-End Trust Pipeline
            </h2>
            <p className="text-sm text-gray-400">
              How funds, autonomous agents, isolated verification, and MST Blockchain interact deterministically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-[#00f2fe] font-bold mb-2">01. DEPOSIT</div>
                <h4 className="font-semibold text-white text-sm mb-1">Escrow Locking</h4>
                <p className="text-xs text-gray-400">
                  Client locks <code>tMSTC</code> into <code>TaskEscrow.sol</code>. Zero risk of agent abandoning work.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-purple-400 font-bold mb-2">02. DISPATCH</div>
                <h4 className="font-semibold text-white text-sm mb-1">Agent Computes</h4>
                <p className="text-xs text-gray-400">
                  Worker agent (Pricing, Research, Analysis) executes task off-chain and delivers structured output.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-emerald-400 font-bold mb-2">03. VERIFY</div>
                <h4 className="font-semibold text-white text-sm mb-1">Isolated Check</h4>
                <p className="text-xs text-gray-400">
                  Verification Agent independently validates output against ground-truth authoritative data.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-[#00f2fe] font-bold mb-2">04. COMMIT</div>
                <h4 className="font-semibold text-white text-sm mb-1">PoAW Hashed</h4>
                <p className="text-xs text-gray-400">
                  Canonical SHA-256 hash generated. Tamper-evident root proof committed to MST Blockchain.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs text-emerald-400 font-bold mb-2">05. SETTLE</div>
                <h4 className="font-semibold text-white text-sm mb-1">Settlement</h4>
                <p className="text-xs text-gray-400">
                  PASS: Payment released & reputation +2. FAIL: Client refunded & reputation slashed -31.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
