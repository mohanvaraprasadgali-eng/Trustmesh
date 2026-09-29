"""
TrustMesh Backend — Comprehensive API Test Suite
=================================================
Tests all endpoints end-to-end:
  - Health check
  - Agent listing + registration
  - Task creation + execution (success & failure modes)
  - Proof retrieval
  - Reputation changes
  - Edge cases & validation
"""

import sys
import json
import time
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://127.0.0.1:8000"

# Default generous timeout for tests
_orig_get = httpx.get
_orig_post = httpx.post
def _safe_get(*args, **kwargs):
    kwargs.setdefault("timeout", 30.0)
    return _orig_get(*args, **kwargs)
def _safe_post(*args, **kwargs):
    kwargs.setdefault("timeout", 30.0)
    return _orig_post(*args, **kwargs)
httpx.get = _safe_get
httpx.post = _safe_post

# ── Colour helpers ─────────────────────────────────────────────────────────
def green(s):  return f"\033[92m{s}\033[0m"
def red(s):    return f"\033[91m{s}\033[0m"
def yellow(s): return f"\033[93m{s}\033[0m"
def cyan(s):   return f"\033[96m{s}\033[0m"
def bold(s):   return f"\033[1m{s}\033[0m"

PASS = green("[PASS]")
FAIL = red("[FAIL]")
INFO = cyan("[INFO]")
WARN = yellow("[WARN]")

results = {"passed": 0, "failed": 0}

def expect(label: str, condition: bool, detail: str = ""):
    if condition:
        print(f"  {PASS} {label}")
        results["passed"] += 1
    else:
        print(f"  {FAIL} {label}" + (f" -- {detail}" if detail else ""))
        results["failed"] += 1

def section(title: str):
    print()
    print(bold(cyan(f"=== {title} ===")))


def test_health():
    section("1. Health Check")
    r = httpx.get(f"{BASE_URL}/api/health")
    data = r.json()
    print(f"  {INFO} Response: {json.dumps(data, indent=2)}")
    expect("Status code 200", r.status_code == 200, str(r.status_code))
    expect("status == 'ok'", data.get("status") == "ok", data.get("status"))
    expect("database_ok == True", data.get("database_ok") is True)
    expect("agents_registered >= 4", data.get("agents_registered", 0) >= 4, str(data.get("agents_registered")))
    expect("blockchain_connected key present", "blockchain_connected" in data)


def test_agents_list():
    section("2. Agents -- List All")
    r = httpx.get(f"{BASE_URL}/api/agents")
    data = r.json()
    expect("Status code 200", r.status_code == 200)
    expect("'agents' key present", "agents" in data)
    expect("At least 4 agents returned", len(data.get("agents", [])) >= 4, str(len(data.get("agents", []))))
    agent = data["agents"][0]
    for field in ["agent_id", "name", "agent_type", "reputation", "tasks_completed", "tasks_verified", "verification_rate", "status"]:
        expect(f"  Agent has field '{field}'", field in agent)
    print(f"  {INFO} Sample agent: {agent['name']} | rep={agent['reputation']} | type={agent['agent_type']}")


def test_agent_by_id():
    section("3. Agents -- Get by ID")
    r = httpx.get(f"{BASE_URL}/api/agents/agent-research-001")
    data = r.json()
    expect("Status 200 for known agent", r.status_code == 200)
    expect("Correct agent_id returned", data.get("agent_id") == "agent-research-001")
    expect("Agent type = research", data.get("agent_type") == "research")
    r2 = httpx.get(f"{BASE_URL}/api/agents/agent-does-not-exist")
    expect("Status 404 for missing agent", r2.status_code == 404)


def test_agent_register():
    section("4. Agents -- Register New")
    test_id = f"agent-test-{int(time.time())}"
    payload = {
        "agent_id": test_id,
        "name": "Test Agent",
        "agent_type": "research",
        "wallet_address": "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
        "metadata_uri": "ipfs://test"
    }
    r = httpx.post(f"{BASE_URL}/api/agents/register", json=payload)
    data = r.json()
    expect("Status 200 on registration", r.status_code == 200)
    expect("success == True", data.get("success") is True)
    expect("agent_id returned correctly", data.get("agent_id") == test_id)
    r2 = httpx.post(f"{BASE_URL}/api/agents/register", json=payload)
    expect("Status 400 on duplicate agent_id", r2.status_code == 400)
    bad_payload = {**payload, "agent_id": f"{test_id}-bad", "wallet_address": "not-a-wallet"}
    r3 = httpx.post(f"{BASE_URL}/api/agents/register", json=bad_payload)
    expect("Status 400 on invalid wallet address", r3.status_code == 400)


def test_task_create():
    section("5. Tasks -- Create")
    payload = {
        "task_type": "pricing",
        "description": "Find the current market price of Laptop X in India",
        "budget": 5.0
    }
    r = httpx.post(f"{BASE_URL}/api/tasks", json=payload)
    data = r.json()
    expect("Status 200 on task create", r.status_code == 200, str(r.status_code))
    expect("success == True", data.get("success") is True)
    expect("task_id generated", "task_id" in data and data["task_id"].startswith("task-"))
    expect("status == CREATED", data.get("status") == "CREATED")
    return data.get("task_id")


def test_task_validation():
    section("6. Tasks -- Validation")
    r = httpx.post(f"{BASE_URL}/api/tasks", json={
        "task_type": "pricing", "description": "Find price of Laptop X", "budget": -1
    })
    expect("Status 422 on negative budget", r.status_code == 422)
    r2 = httpx.post(f"{BASE_URL}/api/tasks", json={
        "task_type": "pricing", "description": "short", "budget": 1.0
    })
    expect("Status 422 on short description", r2.status_code == 422)
    r3 = httpx.post(f"{BASE_URL}/api/tasks", json={
        "task_type": "hacking", "description": "Find price of Laptop X for market research", "budget": 1.0
    })
    expect("Status 422 on invalid task_type", r3.status_code == 422)


def test_task_execute_success():
    section("7. Task Execution -- SUCCESS Mode (Pricing)")
    payload = {
        "task_type": "pricing",
        "description": "Find the market price of Laptop X for a consumer report",
        "budget": 10.0,
        "demo_mode": "success"
    }
    r = httpx.post(f"{BASE_URL}/api/tasks", json=payload)
    task_id = r.json()["task_id"]
    print(f"  {INFO} Created task: {task_id}")
    r_exec = httpx.post(f"{BASE_URL}/api/tasks/{task_id}/execute", timeout=30)
    data = r_exec.json()
    expect("Status 200 on execute", r_exec.status_code == 200, str(r_exec.status_code))
    expect("task_id matches", data.get("task_id") == task_id)
    expect("status == PAID (verified success)", data.get("status") == "PAID", data.get("status"))
    expect("verification.verified == True", data.get("verification", {}).get("verified") is True)
    expect("proof.proof_hash present", bool(data.get("proof", {}).get("proof_hash")))
    expect("reputation.change >= 0 (bonus)", data.get("reputation", {}).get("change", -1) >= 0, str(data.get("reputation", {}).get("change")))
    expect("payment.status == RELEASED", data.get("payment", {}).get("status") == "RELEASED")
    expect("workflow steps > 5", len(data.get("workflow", [])) > 5, str(len(data.get("workflow", []))))
    print(f"  {INFO} Proof hash: {data.get('proof', {}).get('proof_hash', 'N/A')[:40]}...")
    print(f"  {INFO} Reputation: {data.get('reputation', {})}")
    return task_id


def test_task_execute_failure():
    section("8. Task Execution -- FAILURE Mode (Malicious Agent)")
    payload = {
        "task_type": "pricing",
        "description": "Find the market price of Laptop X urgently for client order",
        "budget": 10.0,
        "demo_mode": "failure"
    }
    r = httpx.post(f"{BASE_URL}/api/tasks", json=payload)
    task_id = r.json()["task_id"]
    print(f"  {INFO} Created task: {task_id}")
    r_exec = httpx.post(f"{BASE_URL}/api/tasks/{task_id}/execute", timeout=30)
    data = r_exec.json()
    expect("Status 200 on execute", r_exec.status_code == 200)
    expect("status == REFUNDED (verification failed)", data.get("status") == "REFUNDED", data.get("status"))
    expect("verification.verified == False", data.get("verification", {}).get("verified") is False)
    expect("payment.status == BLOCKED", data.get("payment", {}).get("status") == "BLOCKED")
    expect("reputation.change < 0 (penalty)", data.get("reputation", {}).get("change", 0) < 0, str(data.get("reputation", {}).get("change")))
    print(f"  {INFO} Reason: {data.get('verification', {}).get('reason', '')[:100]}...")
    return task_id


def test_task_research():
    section("9. Task Execution -- Research Task")
    payload = {
        "task_type": "research",
        "description": "Research the MST blockchain ecosystem and its key features for developers",
        "budget": 3.0
    }
    r = httpx.post(f"{BASE_URL}/api/tasks", json=payload)
    task_id = r.json()["task_id"]
    r_exec = httpx.post(f"{BASE_URL}/api/tasks/{task_id}/execute", timeout=30)
    data = r_exec.json()
    expect("Status 200 on research execute", r_exec.status_code == 200)
    expect("Research task verified", data.get("verification", {}).get("verified") is True, str(data.get("verification", {})))
    expect("status == PAID", data.get("status") == "PAID", data.get("status"))
    print(f"  {INFO} Result: {str(data.get('result', {}).get('worker_result', ''))[:80]}...")


def test_task_analysis():
    section("10. Task Execution -- Analysis Task")
    payload = {
        "task_type": "analysis",
        "description": "Perform a comprehensive market analysis of blockchain adoption in India",
        "budget": 8.0
    }
    r = httpx.post(f"{BASE_URL}/api/tasks", json=payload)
    task_id = r.json()["task_id"]
    r_exec = httpx.post(f"{BASE_URL}/api/tasks/{task_id}/execute", timeout=30)
    data = r_exec.json()
    expect("Status 200 on analysis execute", r_exec.status_code == 200)
    expect("Analysis task has proof hash", bool(data.get("proof", {}).get("proof_hash")))
    print(f"  {INFO} Analysis status: {data.get('status')}")


def test_proof_retrieval(task_id: str):
    section("11. Proof Retrieval & Cryptographic Auditing")
    r = httpx.get(f"{BASE_URL}/api/tasks/{task_id}/proof")
    data = r.json()
    expect("Status 200 on proof fetch", r.status_code == 200)
    expect("proof_id present", "proof_id" in data)
    expect("task_id matches", data.get("task_id") == task_id)
    expect("proof_hash present", bool(data.get("proof_hash")))
    expect("result_hash present", bool(data.get("result_hash")))
    expect("verified is bool", isinstance(data.get("verified"), bool))
    expect("canonical_proof structure present", "canonical_proof" in data and isinstance(data["canonical_proof"], dict))
    expect("integrity_verified is True", data.get("integrity_verified") is True)

    # Test POST /api/proofs/verify-proof with authentic proof
    r_ver = httpx.post(f"{BASE_URL}/api/proofs/verify-proof", json={
        "canonical_proof": data["canonical_proof"],
        "expected_proof_hash": data["proof_hash"]
    })
    expect("POST /api/proofs/verify-proof returns 200", r_ver.status_code == 200)
    expect("Canonical proof matches expected hash", r_ver.json().get("valid") is True)

    # Test POST /api/proofs/verify-proof with tampered hash
    r_ver_tampered = httpx.post(f"{BASE_URL}/api/proofs/verify-proof", json={
        "canonical_proof": data["canonical_proof"],
        "expected_proof_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"
    })
    expect("POST /api/proofs/verify-proof catches tampered hash", r_ver_tampered.json().get("valid") is False)

    # Test GET /api/tasks/{task_id}/audit (3-Tier Audit)
    r_audit = httpx.get(f"{BASE_URL}/api/tasks/{task_id}/audit")
    expect("GET /api/tasks/{task_id}/audit returns 200", r_audit.status_code == 200)
    audit_data = r_audit.json()
    expect("3-Tier audit overall valid", audit_data.get("overall_valid") is True)
    expect("Tier 1 result hash valid", audit_data.get("tier1_result_hash", {}).get("valid") is True)
    expect("Tier 2 verification hash valid", audit_data.get("tier2_verification_hash", {}).get("valid") is True)
    expect("Tier 3 proof hash valid", audit_data.get("tier3_proof_hash", {}).get("valid") is True)

    r2 = httpx.get(f"{BASE_URL}/api/tasks/task-doesnotexist/proof")
    expect("404 for non-existent task proof", r2.status_code == 404)


def test_reexecute_blocked(task_id: str):
    section("12. Re-execute Completed Task (Should Fail)")
    r = httpx.post(f"{BASE_URL}/api/tasks/{task_id}/execute", timeout=10)
    expect("Status 400 when re-executing completed task", r.status_code == 400, str(r.status_code))


def test_tasks_list():
    section("13. Tasks -- List All")
    r = httpx.get(f"{BASE_URL}/api/tasks")
    data = r.json()
    expect("Status 200", r.status_code == 200)
    expect("'tasks' key present", "tasks" in data)
    expect("At least 1 task exists", len(data.get("tasks", [])) >= 1)
    task = data["tasks"][0]
    for field in ["task_id", "task_type", "description", "budget", "status", "created_at"]:
        expect(f"  Task has field '{field}'", field in task)


def test_reputation_persisted():
    section("14. Reputation Persistence Check")
    r = httpx.get(f"{BASE_URL}/api/agents/agent-pricing-001")
    data = r.json()
    rep = data.get("reputation", -1)
    tasks_completed = data.get("tasks_completed", -1)
    expect("Reputation is numeric", isinstance(rep, (int, float)))
    expect("tasks_completed updated (> initial 24)", tasks_completed > 24, str(tasks_completed))
    print(f"  {INFO} Pricing agent: rep={rep}, tasks_completed={tasks_completed}")


def test_reputation_history():
    section("15. Reputation History Log")
    # Query research agent history
    r = httpx.get(f"{BASE_URL}/api/agents/agent-research-001/history")
    expect("Status 200 on history fetch", r.status_code == 200)
    data = r.json()
    expect("agent_id returned", data.get("agent_id") == "agent-research-001")
    expect("history is list", isinstance(data.get("history"), list))
    if data.get("history"):
        first = data["history"][0]
        expect("history item has delta", "delta" in first)
        expect("history item has reason", "reason" in first)
        expect("history item has reputation_after", "reputation_after" in first)
        print(f"  {INFO} Latest reputation event: delta={first.get('delta')}, reason={first.get('reason')[:60]}...")

    # 404 for non-existent agent history
    r404 = httpx.get(f"{BASE_URL}/api/agents/non-existent-agent-xyz/history")
    expect("Status 404 for missing agent history", r404.status_code == 404)


def test_api_docs():
    section("16. OpenAPI / Swagger Docs")
    r = httpx.get(f"{BASE_URL}/docs")
    expect("Swagger UI accessible at /docs", r.status_code == 200)
    r2 = httpx.get(f"{BASE_URL}/openapi.json")
    data = r2.json()
    expect("OpenAPI JSON accessible", r2.status_code == 200)
    expect("Title is 'TrustMesh API'", data.get("info", {}).get("title") == "TrustMesh API", data.get("info", {}).get("title"))


def test_verification_endpoints():
    section("17. Verification Engine Endpoints")

    # 1. Test GET /api/verification/reference-data
    r_cat = httpx.get(f"{BASE_URL}/api/verification/reference-data")
    expect("GET /api/verification/reference-data returns 200", r_cat.status_code == 200)
    cat_data = r_cat.json()
    expect("Reference catalog has verifier_id", cat_data.get("verifier_id") == "agent-verification-001")
    expect("Reference catalog has tolerance_percent = 5.0", cat_data.get("tolerance_percent") == 5.0)
    expect("Reference catalog has reputation bonus +2", cat_data.get("reputation_rules", {}).get("bonus_on_pass") == "+2")
    expect("Reference catalog has reputation penalty -31", cat_data.get("reputation_rules", {}).get("penalty_on_fail") == "-31")
    expect("Reference catalog contains verified products", len(cat_data.get("verified_products", [])) >= 10)

    # 2. Test POST /api/verification/verify (PASS CASE)
    req_pass = {
        "task_type": "pricing",
        "task_description": "Fetch verified market price for Laptop X",
        "worker_result": "Market price for Laptop X is ₹59,999",
        "worker_structured_data": {"price": 59999, "currency": "INR", "confidence": 95},
        "worker_agent_id": "agent-pricing-001"
    }
    r_verify_pass = httpx.post(f"{BASE_URL}/api/verification/verify", json=req_pass)
    expect("POST /api/verification/verify returns 200 on valid pricing", r_verify_pass.status_code == 200)
    pass_data = r_verify_pass.json()
    expect("Pass verification verdict is True", pass_data.get("verified") is True)
    expect("Pass verification confidence >= 95", pass_data.get("confidence", 0) >= 95)
    expect("Pass verification proof hash is valid 0x hex", str(pass_data.get("proof", "")).startswith("0x") and len(str(pass_data.get("proof", ""))) == 66)

    # 3. Test POST /api/verification/verify (FAIL CASE - Price tampered)
    req_fail = {
        "task_type": "pricing",
        "task_description": "Fetch verified market price for Laptop X",
        "worker_result": "Market price for Laptop X is ₹99,999 (tampered)",
        "worker_structured_data": {"price": 99999, "currency": "INR"},
        "worker_agent_id": "agent-pricing-001"
    }
    r_verify_fail = httpx.post(f"{BASE_URL}/api/verification/verify", json=req_fail)
    expect("POST /api/verification/verify returns 200 on tampered pricing", r_verify_fail.status_code == 200)
    fail_data = r_verify_fail.json()
    expect("Fail verification verdict is False", fail_data.get("verified") is False)
    expect("Fail verification indicates price discrepancy", "tolerance" in fail_data.get("reason", "").lower() or "discrepancy" in fail_data.get("reason", "").lower() or "exceeds" in fail_data.get("reason", "").lower())
    expect("Fail verification proof hash is valid 0x hex", str(fail_data.get("proof", "")).startswith("0x") and len(str(fail_data.get("proof", ""))) == 66)

    # 4. Test POST /api/verification/verify for Research task
    req_research = {
        "task_type": "research",
        "task_description": "Research MST Blockchain architecture and consensus mechanism",
        "worker_result": "MST Blockchain features EVM compatibility, PoS consensus, and fast sub-second block times.",
        "worker_structured_data": {"topic": "mst blockchain", "sources_analyzed": 5},
        "worker_agent_id": "agent-research-001"
    }
    r_verify_res = httpx.post(f"{BASE_URL}/api/verification/verify", json=req_research)
    expect("POST /api/verification/verify returns 200 on research task", r_verify_res.status_code == 200)
    res_data = r_verify_res.json()
    expect("Research verification proof exists", bool(res_data.get("proof")))


def test_reputation_engine_endpoints():
    section("18. Reputation Engine Endpoints")

    # 1. Test GET /api/reputation/rules
    r_rules = httpx.get(f"{BASE_URL}/api/reputation/rules")
    expect("GET /api/reputation/rules returns 200", r_rules.status_code == 200)
    rules_data = r_rules.json()
    expect("Initial reputation is 80", rules_data.get("initial_reputation") == 80)
    expect("Bonus on pass is 2", rules_data.get("bonus_on_pass") == 2)
    expect("Penalty on fail is 31", rules_data.get("penalty_on_fail") == 31)
    expect("Untrusted threshold is 40", rules_data.get("untrusted_threshold") == 40)
    expect("Recovery tasks needed is 16", rules_data.get("recovery_tasks_needed") == 16)

    # 2. Test GET /api/reputation/leaderboard
    r_lb = httpx.get(f"{BASE_URL}/api/reputation/leaderboard")
    expect("GET /api/reputation/leaderboard returns 200", r_lb.status_code == 200)
    lb_data = r_lb.json()
    expect("Leaderboard has total_agents >= 4", lb_data.get("total_agents", 0) >= 4)
    board = lb_data.get("leaderboard", [])
    expect("Leaderboard has items", len(board) >= 4)
    expect("Top agent has rank 1", board[0].get("rank") == 1)
    expect("Top agent has trust_tier", board[0].get("trust_tier") in ["TRUSTED", "PROBATION", "UNTRUSTED"])
    # Check descending order
    is_desc = all(board[i]["reputation"] >= board[i+1]["reputation"] for i in range(len(board)-1))
    expect("Leaderboard is properly sorted descending by reputation", is_desc)

    # 3. Test POST /api/reputation/simulate (Normal trajectory)
    sim_req = {
        "starting_reputation": 80,
        "sequence": ["pass", "pass", "fail"]
    }
    r_sim = httpx.post(f"{BASE_URL}/api/reputation/simulate", json=sim_req)
    expect("POST /api/reputation/simulate returns 200", r_sim.status_code == 200)
    sim_data = r_sim.json()
    expect("Sim final reputation is 53 (80 + 2 + 2 - 31)", sim_data.get("final_reputation") == 53)
    expect("Sim net change is -27", sim_data.get("net_change") == -27)
    expect("Sim untrusted_triggered is False at 53", sim_data.get("untrusted_triggered") is False)
    expect("Sim returns 3 steps", len(sim_data.get("steps", [])) == 3)

    # 4. Test POST /api/reputation/simulate (Untrusted trigger)
    sim_untrusted_req = {
        "starting_reputation": 80,
        "sequence": ["fail", "fail"]
    }
    r_sim2 = httpx.post(f"{BASE_URL}/api/reputation/simulate", json=sim_untrusted_req)
    sim_data2 = r_sim2.json()
    expect("Sim final reputation is 18 (80 - 31 - 31)", sim_data2.get("final_reputation") == 18)
    expect("Sim untrusted_triggered is True (< 40)", sim_data2.get("untrusted_triggered") is True)
    expect("Last step status is UNTRUSTED", sim_data2.get("steps", [])[-1].get("status") == "UNTRUSTED")


def test_blockchain_stats():
    section("19. Live Blockchain Stats & Contract Addresses")
    r = httpx.get(f"{BASE_URL}/api/blockchain/stats")
    expect("GET /api/blockchain/stats returns 200", r.status_code == 200)
    data = r.json()
    expect("Connected to blockchain is True", data.get("connected") is True)
    expect("Network contains MST Testnet", "MST Testnet" in str(data.get("network", "")))
    expect("Live block number is valid integer", isinstance(data.get("block_number"), int) and data.get("block_number") > 0)
    contracts = data.get("contracts", {})
    expect("AgentRegistry contract config state valid", contracts.get("agent_registry") is None or str(contracts.get("agent_registry")).startswith("0x"))
    expect("ReputationRegistry contract config state valid", contracts.get("reputation_registry") is None or str(contracts.get("reputation_registry")).startswith("0x"))
    expect("TaskEscrow contract config state valid", contracts.get("task_escrow") is None or str(contracts.get("task_escrow")).startswith("0x"))

    # Test GET /api/blockchain/tasks/{task_id}
    r_task_bc = httpx.get(f"{BASE_URL}/api/blockchain/tasks/task-sample-999")
    expect("GET /api/blockchain/tasks/{task_id} returns 200", r_task_bc.status_code == 200)
    bc_task_data = r_task_bc.json()
    expect("Response contains recorded_on_chain key", "recorded_on_chain" in bc_task_data)

    # Test GET /api/blockchain/agents/{agent_id}/onchain
    r_agent_bc = httpx.get(f"{BASE_URL}/api/blockchain/agents/agent-research-001/onchain")
    expect("GET /api/blockchain/agents/{agent_id}/onchain returns 200", r_agent_bc.status_code == 200)
    bc_agent_data = r_agent_bc.json()
    expect("On-chain agent response contains agent_id", bc_agent_data.get("agent_id") == "agent-research-001")
    expect("On-chain agent response contains network info", "MST Testnet" in str(bc_agent_data.get("network", "")))
    expect("On-chain agent response contains agent_registry_address field", "agent_registry_address" in bc_agent_data)


if __name__ == "__main__":
    print(bold(cyan("\n" + "="*60)))
    print(bold(cyan("  TrustMesh Backend -- Full API Test Suite")))
    print(bold(cyan("="*60)))

    try:
        test_health()
        test_agents_list()
        test_agent_by_id()
        test_agent_register()
        test_task_create()
        test_task_validation()
        success_task_id = test_task_execute_success()
        failure_task_id = test_task_execute_failure()
        test_task_research()
        test_task_analysis()
        test_proof_retrieval(success_task_id)
        test_reexecute_blocked(success_task_id)
        test_tasks_list()
        test_reputation_persisted()
        test_reputation_history()
        test_verification_endpoints()
        test_reputation_engine_endpoints()
        test_blockchain_stats()
        test_api_docs()


    except httpx.ConnectError:
        print(red("\n[ERROR] Could not connect to backend at http://localhost:8000"))
        print(yellow("  Make sure the server is running: uvicorn main:app --port 8000"))
        sys.exit(1)
    except Exception as e:
        print(red(f"\n[ERROR] Unexpected error: {e}"))
        import traceback
        traceback.print_exc()

    total = results["passed"] + results["failed"]
    print()
    print(bold(cyan("="*60)))
    print(bold(f"  RESULTS: {green(str(results['passed'])+' passed')} / {red(str(results['failed'])+' failed')} / {total} total"))
    print(bold(cyan("="*60)))
    if results["failed"] > 0:
        sys.exit(1)
