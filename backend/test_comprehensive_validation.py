"""
TrustMesh — Phase 17 & 18 Comprehensive 20-Point Validation Test Suite
Tests all 20 required points end-to-end against the live backend in LOCAL DEMO MODE.
"""

import sys
import json
import urllib.request
import urllib.error
import time

BASE_URL = "http://localhost:8000"

passed = 0
failed = 0

def log(msg, ok=True):
    global passed, failed
    if ok:
        passed += 1
        print(f"  [PASS] {msg}")
    else:
        failed += 1
        print(f"  [FAIL] {msg}")

def request(method, path, body=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, {"detail": content}

def run_tests():
    print("=" * 60)
    print("  TrustMesh 20-Point Comprehensive Validation Suite")
    print("=" * 60)

    # 1. Dynamic Task Routing
    print("\n--- 1. Dynamic Task Routing ---")
    routing_cases = [
        ("Create a PowerPoint presentation about AI ethics", "research"),
        ("Analyze electric vehicle market trends", "analysis"),
        ("Find the current price of a smartphone under ₹30,000", "pricing"),
        ("Explain neural networks in simple terms", "research"),
        ("Compare cloud computing providers", "analysis"),
        ("Calculate the ROI or percentage increase from 500 to 750", "analysis")
    ]
    for prompt, expected_type in routing_cases:
        st, res = request("POST", "/api/tasks", {
            "task_type": "auto",
            "description": prompt,
            "budget": 0.05
        })
        if st == 200:
            task_id = res["task_id"]
            st_ex, res_ex = request("POST", f"/api/tasks/{task_id}/execute")
            target_type = res_ex.get("orchestrator", {}).get("agent_type") or res_ex.get("task_type")
            log(f"Dynamic route '{prompt[:32]}...' -> {target_type}", target_type == expected_type)
        else:
            log(f"Create task for routing test failed: {res}", False)

    # 2. Agent Registration
    print("\n--- 2. Agent Registration ---")
    test_agent_id = f"agent-eval-{int(time.time())}"
    valid_wallet = "0x" + "11" * 20
    st_reg, res_reg = request("POST", "/api/agents/register", {
        "agent_id": test_agent_id,
        "name": "Audit Validation Node",
        "agent_type": "analysis",
        "wallet_address": valid_wallet,
        "metadata_uri": "ipfs://QmValidationNode"
    })
    log("Agent registered successfully with valid fields", st_reg == 200 and res_reg.get("agent_id") == test_agent_id)

    # 3. Duplicate Agent Prevention
    print("\n--- 3. Duplicate Agent Prevention ---")
    st_dup, res_dup = request("POST", "/api/agents/register", {
        "agent_id": test_agent_id,
        "name": "Audit Validation Node Duplicate",
        "agent_type": "analysis",
        "wallet_address": valid_wallet
    })
    log("Duplicate agent ID registration rejected with 400", st_dup == 400)

    # Invalid wallet prevention
    st_bad_w, _ = request("POST", "/api/agents/register", {
        "agent_id": f"agent-bad-{int(time.time())}",
        "name": "Bad Wallet Node",
        "agent_type": "research",
        "wallet_address": "invalid-address"
    })
    log("Invalid wallet address rejected with 400", st_bad_w == 400)

    # Empty name prevention
    st_bad_name, _ = request("POST", "/api/agents/register", {
        "agent_id": f"agent-noname-{int(time.time())}",
        "name": "   ",
        "agent_type": "research",
        "wallet_address": valid_wallet
    })
    log("Empty agent name rejected with 400", st_bad_name == 400)

    # 4. Task Creation
    print("\n--- 4. Task Creation ---")
    st_tc, res_tc = request("POST", "/api/tasks", {
        "task_type": "research",
        "description": "Explain the principles of Byzantine fault tolerance.",
        "budget": 0.05
    })
    task_id_4 = res_tc.get("task_id")
    log("Task creation succeeds with valid task_id and CREATED status", st_tc == 200 and res_tc.get("status") == "CREATED")

    # 5. Worker Execution
    print("\n--- 5. Worker Execution ---")
    st_we, res_we = request("POST", f"/api/tasks/{task_id_4}/execute")
    worker_out = res_we.get("result", {}).get("worker_result", "")
    log("Worker execution returns substantive non-empty output", st_we == 200 and len(worker_out) > 30)

    # 6. Independent Verification
    print("\n--- 6. Independent Verification ---")
    worker_agent = res_we.get("agent", {}).get("agent_id")
    verifier_agent = res_we.get("verification", {}).get("verifier_id") or res_we.get("verification", {}).get("verification_agent_id")
    log(f"Worker ({worker_agent}) is separate from Verifier ({verifier_agent})", worker_agent != verifier_agent and verifier_agent == "agent-verification-001")

    # 7. Successful Verification
    print("\n--- 7. Successful Verification ---")
    log("Truthful worker output independently passes verification", res_we.get("verification", {}).get("verified") is True)

    # 8. Failed Verification
    print("\n--- 8. Failed Verification ---")
    st_mal, res_mal = request("POST", "/api/tasks", {
        "task_type": "pricing",
        "description": "Find current market price and vendor deals for Laptop X",
        "budget": 0.05,
        "demo_mode": "failure"
    })
    task_id_mal = res_mal["task_id"]
    st_mal_ex, res_mal_ex = request("POST", f"/api/tasks/{task_id_mal}/execute")
    log("Manipulated worker result independently fails verification", res_mal_ex.get("verification", {}).get("verified") is False)

    # 9. Proof Generation
    print("\n--- 9. Proof Generation ---")
    proof = res_we.get("proof", {})
    proof_hash = proof.get("proof_hash", "")
    log("Proof generated with canonical SHA-256 root hash starting with 0x", proof_hash.startswith("0x") and len(proof_hash) == 66)

    # 10. Proof Tamper Detection
    print("\n--- 10. Proof Tamper Detection ---")
    st_audit, res_audit = request("GET", f"/api/tasks/{task_id_4}/audit")
    log("Original proof passes 3-tier integrity audit", res_audit.get("overall_valid") is True)

    st_tamper, res_tamper = request("POST", "/api/proofs/verify-proof", {
        "canonical_proof": {
            **proof.get("canonical_proof", {}),
            "result_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"
        },
        "expected_proof_hash": proof_hash
    })
    log("Tampered proof hash detected and rejected", res_tamper.get("valid") is False)

    # 11. Escrow Release
    print("\n--- 11. Escrow Release ---")
    log("Verified success releases escrow payment (payment.status == RELEASED)", res_we.get("payment", {}).get("status") == "RELEASED")
    log("Task status updated to PAID upon escrow release", res_we.get("status") == "PAID")

    # 12. Escrow Block / Refund
    print("\n--- 12. Escrow Block / Refund ---")
    log("Verification failure blocks escrow payment (payment.status == BLOCKED)", res_mal_ex.get("payment", {}).get("status") == "BLOCKED")
    log("Task status updated to REFUNDED upon payment block", res_mal_ex.get("status") == "REFUNDED")

    # 13. Reputation Increase
    print("\n--- 13. Reputation Increase ---")
    rep_change = res_we.get("reputation", {}).get("change")
    log(f"Reputation increased on verified pass (delta = {rep_change})", rep_change == 2 or (rep_change == 0 and res_we.get("reputation", {}).get("before") == 100))

    # 14. Reputation Decrease
    print("\n--- 14. Reputation Decrease ---")
    mal_rep_change = res_mal_ex.get("reputation", {}).get("change")
    log(f"Reputation penalized on verified failure (delta = {mal_rep_change})", mal_rep_change == -31)

    # 15. Reputation Bounds (0 <= rep <= 100)
    print("\n--- 15. Reputation Bounds ---")
    st_sim_floor, res_sim_floor = request("POST", "/api/reputation/simulate", {
        "starting_reputation": 20,
        "sequence": ["fail", "fail"]
    })
    log("Reputation floor enforced at minimum 0", res_sim_floor.get("final_reputation") == 0)

    st_sim_cap, res_sim_cap = request("POST", "/api/reputation/simulate", {
        "starting_reputation": 99,
        "sequence": ["pass", "pass"]
    })
    log("Reputation ceiling enforced at maximum 100", res_sim_cap.get("final_reputation") == 100)

    # 16. Duplicate Reputation Prevention
    print("\n--- 16. Duplicate Reputation Prevention ---")
    st_re_exec, res_re_exec = request("POST", f"/api/tasks/{task_id_4}/execute")
    log("Attempted re-execution of settled task rejected with 400", st_re_exec == 400)

    # 17. Task Lifecycle
    print("\n--- 17. Task Lifecycle ---")
    st_task_fetch, res_task_fetch = request("GET", f"/api/tasks/{task_id_4}")
    log("Task record reflects completed state and stored proof hash", 
        res_task_fetch.get("status") in ["PAID", "COMPLETED"] and res_task_fetch.get("proof_hash") == proof_hash)

    # 18. Malicious-Agent Scenario (Phase 18 Scenario B)
    print("\n--- 18. Malicious-Agent Scenario (Scenario B) ---")
    log("Worker intentionally returns incorrect price", "49,999" in res_mal_ex.get("result", {}).get("worker_result", ""))
    log("Verifier independently catches mismatch and flags FAIL", res_mal_ex.get("verification", {}).get("verified") is False)
    log("Escrow BLOCKED and client refunded", res_mal_ex.get("payment", {}).get("status") == "BLOCKED")
    log("Agent reputation slashed by -31", res_mal_ex.get("reputation", {}).get("change") == -31)
    log("Task marked REFUNDED", res_mal_ex.get("status") == "REFUNDED")

    # 19. Truthful-Agent Scenario (Phase 18 Scenario A)
    print("\n--- 19. Truthful-Agent Scenario (Scenario A) ---")
    st_scen_a, res_scen_a = request("POST", "/api/tasks", {
        "task_type": "auto",
        "description": "Create a short seminar outline about artificial intelligence.",
        "budget": 0.05
    })
    task_id_a = res_scen_a["task_id"]
    st_a_ex, res_a_ex = request("POST", f"/api/tasks/{task_id_a}/execute")
    log("Scenario A auto-routes to Research Agent", res_a_ex.get("orchestrator", {}).get("agent_type") == "research")
    log("Scenario A worker returns substantive seminar outline", len(res_a_ex.get("result", {}).get("worker_result", "")) > 50)
    log("Scenario A Verification Agent passes result", res_a_ex.get("verification", {}).get("verified") is True)
    log("Scenario A Proof of Agent Work hash generated", res_a_ex.get("proof", {}).get("proof_hash", "").startswith("0x"))
    log("Scenario A Escrow RELEASED", res_a_ex.get("payment", {}).get("status") == "RELEASED")
    log("Scenario A Reputation increases (+2 or capped at 100)", res_a_ex.get("reputation", {}).get("change") == 2 or (res_a_ex.get("reputation", {}).get("change") == 0 and res_a_ex.get("reputation", {}).get("before") == 100))
    log("Scenario A Task status completed/paid", res_a_ex.get("status") == "PAID")

    # 20. Dashboard Statistics
    print("\n--- 20. Dashboard Statistics ---")
    st_h, res_h = request("GET", "/api/health")
    st_ag, res_ag = request("GET", "/api/agents")
    st_tk, res_tk = request("GET", "/api/tasks")
    st_lb, res_lb = request("GET", "/api/reputation/leaderboard")

    log("Health endpoint returns database_ok and agents count", res_h.get("database_ok") is True and res_h.get("agents_registered", 0) >= 4)
    log("Agents endpoint returns list with active agents", len(res_ag.get("agents", [])) >= 4)
    log("Tasks endpoint returns list with recorded tasks", len(res_tk.get("tasks", [])) > 0)
    log("Leaderboard returns real reputation rankings", len(res_lb.get("leaderboard", [])) >= 4)

    # Clean up evaluation test agents
    import sqlite3
    conn = sqlite3.connect("backend/trustmesh.db")
    c = conn.cursor()
    c.execute("DELETE FROM agents WHERE agent_id LIKE 'agent-eval-%'")
    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print(f"  VALIDATION SUMMARY: {passed} passed / {failed} failed / {passed + failed} total")
    print("=" * 60)
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
