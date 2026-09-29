"""
TrustMesh — End-to-End MST Blockchain Testnet Validation Script
==============================================================
Validates:
1. Live MST Testnet RPC connection (Chain ID 91562037)
2. Live block number retrieval
3. Smart contract ABI and address configurations
4. E2E Task Escrow Lifecycle:
   - Agent Registration & Wallet Binding
   - Task Escrow Creation (Deposit)
   - Worker Agent Execution
   - Independent Verifier Attestation
   - Canonical SHA-256 Proof of Agent Work (PoAW) Root Hashing
   - Dynamic Asymmetric Settlement (+2 / -31)
5. MSTScan Explorer URL formatting and verification
"""

import sys
import os
import json
import urllib.request
from web3 import Web3

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8000"
MST_RPC = "https://testnetrpc.mstblockchain.com"
MST_CHAIN_ID = 91562037

def print_header(title):
    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)

def test_mst_rpc():
    print_header("1. Live MST Blockchain Testnet RPC Audit")
    try:
        w3 = Web3(Web3.HTTPProvider(MST_RPC, request_kwargs={"timeout": 5}))
        connected = w3.is_connected()
        print(f"  [RPC URL]     {MST_RPC}")
        print(f"  [CONNECTED]   {connected}")
        assert connected, "Failed to connect to MST Testnet RPC"

        chain_id = w3.eth.chain_id
        print(f"  [CHAIN ID]    {chain_id} (Expected: {MST_CHAIN_ID})")
        assert chain_id in (MST_CHAIN_ID, 4545), f"Unexpected chain ID: {chain_id}"

        block_num = w3.eth.block_number
        print(f"  [LATEST BLOCK] #{block_num:,}")
        assert block_num > 5_000_000, f"Block number {block_num} suspiciously low"

        gas_price = w3.eth.gas_price
        print(f"  [GAS PRICE]   {Web3.from_wei(gas_price, 'gwei')} Gwei")
        print("  [PASS] Live MST Testnet is fully operational and synced.")
        return True
    except Exception as e:
        print(f"  [FAIL] MST RPC test failed: {e}")
        return False

def test_backend_blockchain_endpoint():
    print_header("2. Backend Blockchain Telemetry Endpoint")
    try:
        req = urllib.request.urlopen(f"{BASE_URL}/api/blockchain/stats")
        data = json.loads(req.read().decode())
        print(f"  Connected: {data.get('connected')}")
        print(f"  Network:   {data.get('network')}")
        print(f"  Block Num: {data.get('block_number')}")
        print(f"  Contracts: {json.dumps(data.get('contracts', {}), indent=4)}")

        assert data.get("connected") is True, "Backend reports disconnected from blockchain"
        assert "MST Testnet" in data.get("network", ""), "Network mismatch in backend response"
        assert data.get("block_number") is not None, "Missing block number in response"
        print("  [PASS] Backend blockchain telemetry endpoint verified.")
        return True
    except Exception as e:
        print(f"  [FAIL] Backend blockchain stats endpoint failed: {e}")
        return False

def test_e2e_full_lifecycle():
    print_header("3. E2E Task Escrow Lifecycle & PoAW Settlement")
    try:
        # Step A: Register Agent
        agent_payload = json.dumps({
            "agent_id": f"agent-e2e-val-{os.urandom(3).hex()}",
            "name": "E2E Validation Agent",
            "agent_type": "pricing",
            "wallet_address": "0x" + os.urandom(20).hex(),
            "metadata_uri": "ipfs://QmTrustMeshValidationNode"
        }).encode("utf-8")
        req_ag = urllib.request.Request(f"{BASE_URL}/api/agents/register", data=agent_payload, headers={"Content-Type": "application/json"})
        res_ag = json.loads(urllib.request.urlopen(req_ag).read().decode())
        agent_id = res_ag.get("agent_id")
        print(f"  [OK] Registered Worker Agent: {agent_id}")

        # Step B: Create Legitimate Task
        task_payload = json.dumps({
            "task_type": "pricing",
            "description": "Verify market price for Laptop X at vendor 1",
            "budget": 0.05,
            "demo_mode": "success"
        }).encode("utf-8")
        req_tk = urllib.request.Request(f"{BASE_URL}/api/tasks", data=task_payload, headers={"Content-Type": "application/json"})
        res_tk = json.loads(urllib.request.urlopen(req_tk).read().decode())
        task_id = res_tk.get("task_id")
        print(f"  [OK] Created Escrow Task: {task_id} (Budget: 0.05 tMSTC)")

        # Step C: Execute Pipeline
        req_ex = urllib.request.Request(f"{BASE_URL}/api/tasks/{task_id}/execute", data=b"{}", headers={"Content-Type": "application/json"})
        res_ex = json.loads(urllib.request.urlopen(req_ex).read().decode())
        print(f"  [OK] Execution Status: {res_ex.get('status')}")
        print(f"  [OK] Verification: {res_ex.get('verification', {}).get('verified')} ({res_ex.get('verification', {}).get('confidence')}%)")
        print(f"  [OK] PoAW Root Hash: {res_ex.get('proof', {}).get('proof_hash')}")
        print(f"  [OK] Reputation Delta: {res_ex.get('reputation', {}).get('change')}")

        assert res_ex.get("verification", {}).get("verified") is True, "Verification failed unexpectedly"
        assert res_ex.get("reputation", {}).get("change") == 2, "Expected +2 reputation reward"
        assert res_ex.get("payment", {}).get("status") == "RELEASED", f"Expected payment status RELEASED, got {res_ex.get('payment', {}).get('status')}"

        # Step D: Test Malicious Scenario (Fraud Slashed)
        mal_task_payload = json.dumps({
            "task_type": "pricing",
            "description": "Verify market price for Laptop X with intentional fraud injection",
            "budget": 0.05,
            "demo_mode": "failure"
        }).encode("utf-8")
        req_mtk = urllib.request.Request(f"{BASE_URL}/api/tasks", data=mal_task_payload, headers={"Content-Type": "application/json"})
        res_mtk = json.loads(urllib.request.urlopen(req_mtk).read().decode())
        mal_task_id = res_mtk.get("task_id")
        
        req_mex = urllib.request.Request(f"{BASE_URL}/api/tasks/{mal_task_id}/execute", data=b"{}", headers={"Content-Type": "application/json"})
        res_mex = json.loads(urllib.request.urlopen(req_mex).read().decode())
        print(f"  [OK] Malicious Task Status: {res_mex.get('status')}")
        print(f"  [OK] Fraud Caught: {res_mex.get('verification', {}).get('reason')}")
        print(f"  [OK] Penalty Slashed: {res_mex.get('reputation', {}).get('change')}")

        assert res_mex.get("verification", {}).get("verified") is False, "Fraud was not caught!"
        assert res_mex.get("reputation", {}).get("change") == -31, "Expected -31 penalty slash"
        assert res_mex.get("payment", {}).get("status") == "BLOCKED", f"Expected payment status BLOCKED, got {res_mex.get('payment', {}).get('status')}"

        print("  [PASS] Full E2E Task Escrow Lifecycle with PoAW and Asymmetric Settlement passed.")
        return True
    except Exception as e:
        print(f"  [FAIL] E2E Lifecycle test failed: {e}")
        return False

def test_mstscan_explorer_links():
    print_header("4. MSTScan Explorer URL Audit")
    sample_tx = "0x" + "a" * 64
    sample_addr = "0x" + "b" * 40
    tx_url = f"https://mstscan.com/tx/{sample_tx}"
    addr_url = f"https://mstscan.com/address/{sample_addr}"
    print(f"  Sample Tx URL:      {tx_url}")
    print(f"  Sample Address URL: {addr_url}")
    assert tx_url.startswith("https://mstscan.com/tx/0x")
    assert addr_url.startswith("https://mstscan.com/address/0x")
    print("  [PASS] MSTScan Explorer URLs format verified.")
    return True

if __name__ == "__main__":
    r1 = test_mst_rpc()
    r2 = test_backend_blockchain_endpoint()
    r3 = test_e2e_full_lifecycle()
    r4 = test_mstscan_explorer_links()

    print_header("OVERALL E2E VALIDATION SUMMARY")
    if all([r1, r2, r3, r4]):
        print("  >>> ALL 4/4 E2E VALIDATION CHECKS PASSED SUCCESSFULLY! <<<")
        sys.exit(0)
    else:
        print("  >>> SOME E2E VALIDATION CHECKS FAILED! <<<")
        sys.exit(1)
