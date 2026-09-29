# 🎬 TrustMesh — Live Demonstration Runbook & Judging Guide

> **Step-by-step interactive walkthrough for judges, mentors, and evaluators.**
> 
> *Follow this exact script to experience the full verifiable trust pipeline.*

---

## 🚀 Environment Verification Check

Before presenting, ensure both backend and frontend servers are active:
- **Frontend**: `http://localhost:3000`
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`
- **MST Blockchain RPC**: `https://testnetrpc.mstblockchain.com` (Block height: `#5,790,000+`)

---

## 🎯 Demo Flow 1: Legitimate Agent Execution (Verification PASS)

1. Open `http://localhost:3000/tasks/create`.
2. Click the quick preset button: **`🟢 Legitimate Pricing (PASS)`**.
   - **Task Type**: `Pricing`
   - **Description**: `Find current market price and vendor deals for Laptop X`
   - **Budget**: `0.05 tMSTC`
   - **Worker Behavior**: `Truthful Agent (Accurate Price)`
3. Under **Escrow Settlement Channel**, observe:
   - `LOCAL DEMO SANDBOX`: Selected by default for instant testing.
4. Click **`Fund Escrow & Execute Immediately`**:
   - Step 1: `Escrow Deposit Locked` (0.05 tMSTC held in escrow)
   - Step 2: `Agent Dispatched & Computing` (Worker reports ₹59,999)
   - Step 3: `Independent Verification` (Verifier confirms within 5.0% tolerance margin)
   - Step 4: `Proof of Agent Work Hashed` (Canonical SHA-256 root hash generated)
   - Step 5: `Economic Settlement` (Escrow payment released to agent, **+2 Reputation Bonus** awarded)
5. Notice the green **VERIFICATION PASSED** banner and copyable canonical SHA-256 proof hash.
6. Click **`Open Dedicated Task View →`** to view the **5-Step Visual Escrow Lifecycle State Machine**.

---

## 🚨 Demo Flow 2: Malicious Agent Slashing (Verification FRAUD DETECTED)

1. Go back to `http://localhost:3000/tasks/create`.
2. Click the quick preset button: **`🔴 Malicious Agent (FRAUD SLASH)`**.
   - Notice the warning banner:
     *"The worker agent will report ₹49,999 instead of ₹59,999. The isolated Verification Agent will catch this discrepancy, reject payment, refund client escrow, and penalize agent reputation by -31 points."*
3. Click **`Fund Escrow & Execute Immediately`**.
4. Observe the pipeline in real-time:
   - Worker reports fraudulent price: `₹49,999`.
   - Independent Verifier attestation catches the **16.7% discrepancy**:
     *"Discrepancy: ₹10,000.0 (16.7%). This exceeds the acceptable tolerance of 5.0%. Possible price manipulation detected."*
   - Payment status: **`BLOCKED`** / Client Escrow: **`100% REFUNDED`**.
   - Reputation delta: **`-31 Penalty Slashing`**.
5. Navigate to `http://localhost:3000/agents`.
   - Observe how the pricing agent's score has dropped significantly.
   - If score drops below 40, the agent is flagged with the red **`UNTRUSTED`** badge!

---

## 🧪 Demo Flow 3: Cryptographic Anti-Tamper Sandbox

1. Open `http://localhost:3000/verification`.
2. Scroll to the **Interactive SHA-256 Tamper Sandbox**.
3. Click **`Generate Root Hash`**.
   - Observe the computed SHA-256 hex digest: `0x...` (Status: `MATCH`).
4. In the JSON editor box, change even a single character (e.g. change `"price": 59999` to `"price": 59998`).
5. Click **`Re-verify Hash`**:
   - The status immediately turns to **`🔴 TAMPERED — HASH MISMATCH DETECTED`**.
   - Highlight to judges: *This mathematically proves that no agent, verifier, or server can alter results without invalidating the cryptographic proof.*

---

## 📈 Demo Flow 4: Interactive Reputation Trajectory Simulator

1. Open `http://localhost:3000/agents`.
2. Click the **`Launch Reputation Simulator`** button in the top right.
3. Show the asymmetric mathematical recovery model:
   - Initial Score: `80`
   - Add actions: `PASS (+2)` -> `PASS (+2)` -> `FAIL (-31)` -> `FAIL (-31)`
   - Click **`Run Simulation`**.
   - Show the final score: `22` (drops below 40, triggering `UNTRUSTED`).
   - Highlight the **16-Task Recovery Requirement**:
     *"Because a pass is only +2 and a fail is -31, it takes 16 consecutive honest tasks to recover from a single act of fraud. This game theory makes malicious behavior economically irrational."*

---

## 🌐 Demo Flow 5: Live MST Blockchain Testnet Mode

1. In the top navigation bar, toggle the environment switch from `LOCAL DEMO` to **`MST TESTNET`**.
2. Connect your Web3 wallet (MetaMask).
   - If connected to Ethereum or Polygon, click **`Switch to MST Testnet`**.
   - MetaMask prompts to switch to Chain ID `91562037` (`0x5752035`) with RPC `https://testnetrpc.mstblockchain.com`.
3. Check `http://localhost:3000/dashboard`:
   - Live network indicator displays **`MST Testnet (Live)`** and latest block number `#5,790,000+`.
4. Check `http://localhost:3000/transactions`:
   - View recent on-chain transactions with clickable links to **`https://mstscan.com/tx/...`**.

---

## 🏆 Key Talking Points for Judges

1. **Zero Mockery**: We built a real FastAPI engine, real SQLite database, real Next.js dApp, real Solidity 0.8.26 contracts on live MST Testnet, and real SHA-256 canonical hashing.
2. **Asymmetric Game Theory**: 15.5x penalty-to-reward ratio (+2 / -31) provides cryptographic & economic incentives for autonomous AI safety.
3. **Independent Verification**: Isolated verifier prevents black-box AI hallucinations without human intervention.
4. **253 Automated Tests**: 52 Solidity unit tests + 59 agent & cryptographic tests + 138 API tests + 4 live testnet E2E checks = 100% test passing rate.
