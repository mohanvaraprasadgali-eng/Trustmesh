"""
TrustMesh — Agent Execution Engine Comprehensive Unit Test Suite
==================================================================
Tests all 4 autonomous agents independently:
  1. PricingAgent
  2. ResearchAgent
  3. AnalysisAgent
  4. VerificationAgent
  5. Proof of Agent Work Generator
"""

import asyncio
import sys
import os
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.pricing_agent import PricingAgent, PRODUCT_PRICES
from agents.research_agent import ResearchAgent, RESEARCH_DATABASE
from agents.analysis_agent import AnalysisAgent
from agents.verification_agent import VerificationAgent, VERIFIED_PRICES, PRICE_TOLERANCE_PERCENT
from proof.proof_generator import generate_proof_of_work, hash_data, verify_canonical_proof, audit_full_proof

# Test counters
passed = 0
failed = 0

def check(label: str, condition: bool, info: str = ""):
    global passed, failed
    if condition:
        print(f"  \033[92m[PASS]\033[0m {label}")
        passed += 1
    else:
        print(f"  \033[91m[FAIL]\033[0m {label} {info}")
        failed += 1

def section(title: str):
    print(f"\n\033[96m=== {title} ===\033[0m")


async def test_pricing_agent():
    section("1. Pricing Agent Tests")
    agent = PricingAgent()
    check("Agent ID is set", agent.agent_id == "agent-pricing-001")
    check("Agent type is pricing", agent.agent_type == "pricing")

    # Normal execution: Laptop X
    res_normal = await agent.execute("Find market price for Laptop X", demo_mode="success")
    check("Normal execution returns string formatted price", "₹" in res_normal["result"])
    check("Structured data price == 59999", res_normal["structured_data"]["price"] == 59999)
    check("Not marked malicious", res_normal["structured_data"]["is_malicious"] is False)
    check("High confidence for honest result", res_normal["confidence"] >= 90)

    # Specific product: MacBook Pro
    res_mac = await agent.execute("Find lowest price for MacBook Pro M3")
    check("Extracted MacBook Pro correctly", res_mac["structured_data"]["price"] == 169900)

    # Specific product: iPhone 16
    res_iphone = await agent.execute("Current deal on iPhone 16 India")
    check("Extracted iPhone 16 correctly", res_iphone["structured_data"]["price"] == 79900)

    # Malicious failure mode: Laptop X with demo_mode='failure'
    res_malicious = await agent.execute("Find market price for Laptop X", demo_mode="failure")
    check("Malicious price is offset by -10000", res_malicious["structured_data"]["price"] == 49999)
    check("Marked as malicious", res_malicious["structured_data"]["is_malicious"] is True)
    check("Confidence degraded", res_malicious["confidence"] == 65)


async def test_research_agent():
    section("2. Research Agent Tests")
    agent = ResearchAgent()
    check("Agent ID is set", agent.agent_id == "agent-research-001")
    check("Agent type is research", agent.agent_type == "research")

    # Topic: MST Blockchain
    res_mst = await agent.execute("Tell me about MST Blockchain features")
    check("Identified MST Blockchain topic", "4545" in res_mst["result"] or "mst" in res_mst["result"].lower())
    check("Has sources", len(res_mst["structured_data"]["sources"]) > 0)
    check("Has key points", len(res_mst["structured_data"]["key_points"]) > 0)
    check("Confidence is high", res_mst["confidence"] >= 90)

    # Topic: TrustMesh Protocol
    res_tm = await agent.execute("Explain the TrustMesh protocol architecture")
    check("Identified TrustMesh topic", "trust layer" in res_tm["result"].lower() or "trustmesh" in res_tm["result"].lower())

    # Fallback topic
    res_fallback = await agent.execute("Research quantum supercomputing in deep space")
    check("Fallback returns structured summary", len(res_fallback["result"]) > 0)
    check("Fallback has sources", len(res_fallback["structured_data"]["sources"]) > 0)


async def test_analysis_agent():
    section("3. Analysis Agent Tests")
    agent = AnalysisAgent()
    check("Agent ID is set", agent.agent_id == "agent-analysis-001")
    check("Agent type is analysis", agent.agent_type == "analysis")

    # Price analysis normal
    res_price = await agent.execute("Analyze laptop pricing trends in India", demo_mode="success")
    check("Analysis contains summary", len(res_price["result"]) > 20)
    check("Structured data contains findings", len(res_price["structured_data"]["findings"]) > 0)
    check("Analysis confidence high", res_price["confidence"] >= 80)

    # Technology analysis
    res_tech = await agent.execute("Perform risk analysis of AI agents interacting with Web3 smart contracts")
    check("Identified tech analysis", res_tech["structured_data"]["analysis_type"] == "technology_analysis")
    check("Contains recommendation", "recommendation" in res_tech["structured_data"])

    # Failure mode
    res_fail = await agent.execute("Analyze price", demo_mode="failure")
    check("Failure mode has lower confidence", res_fail["confidence"] <= 40)


async def test_verification_agent():
    section("4. Verification Agent Invariant & Attestation Tests")
    verifier = VerificationAgent()
    check("Verifier ID is set", verifier.agent_id == "agent-verification-001")

    # Test 1: Pricing Exact Match -> PASS
    att_pass = await verifier.verify(
        task_id="task-test-01",
        task_type="pricing",
        task_description="Find price for Laptop X",
        worker_agent_id="agent-pricing-001",
        worker_result="₹59,999",
        worker_structured_data={"price": 59999, "currency": "INR"},
        demo_mode="success"
    )
    check("Pricing exact match verified == True", att_pass["verified"] is True)
    check("Attestation confidence >= 95", att_pass["confidence"] >= 95)
    check("Proof hash starts with 0x", att_pass["proof"].startswith("0x"))
    check("Reputation bonus is +2", att_pass["reputation_change"] == "+2")

    # Test 2: Pricing Within 5% Tolerance -> PASS
    # 59999 * 1.03 = 61798.97 (3% variance)
    att_tolerance = await verifier.verify(
        task_id="task-test-02",
        task_type="pricing",
        task_description="Find price for Laptop X",
        worker_agent_id="agent-pricing-001",
        worker_result="₹61,000",
        worker_structured_data={"price": 61000, "currency": "INR"},
        demo_mode=None
    )
    check("3% variance is within 5% tolerance -> PASS", att_tolerance["verified"] is True)

    # Test 3: Pricing Outside 5% Tolerance -> FAIL
    # 59999 * 1.15 = 68998 (15% variance)
    att_exceeded = await verifier.verify(
        task_id="task-test-03",
        task_type="pricing",
        task_description="Find price for Laptop X",
        worker_agent_id="agent-pricing-001",
        worker_result="₹69,000",
        worker_structured_data={"price": 69000, "currency": "INR"},
        demo_mode=None
    )
    check("15% variance exceeds 5% tolerance -> FAIL", att_exceeded["verified"] is False)
    check("Reputation penalty is -31", att_exceeded["reputation_change"] == "-31")

    # Test 4: Malicious Failure Mode Simulation -> FAIL & SLASH
    att_malicious = await verifier.verify(
        task_id="task-test-04",
        task_type="pricing",
        task_description="Find price for Laptop X",
        worker_agent_id="agent-pricing-001",
        worker_result="₹49,999",
        worker_structured_data={"price": 49999, "currency": "INR"},
        demo_mode="failure"
    )
    check("Malicious demo mode caught -> FAIL", att_malicious["verified"] is False)
    check("Reason mentions discrepancy", "Discrepancy" in att_malicious["reason"] or "manipulation" in att_malicious["reason"])

    # Test 5: Research Completeness Checks
    att_res_good = await verifier.verify(
        task_id="task-test-05",
        task_type="research",
        task_description="Research Web3",
        worker_agent_id="agent-research-001",
        worker_result="Web3 is the decentralized next generation of the World Wide Web built on trustless blockchain networks.",
        worker_structured_data={"sources": ["W3F"], "key_points": ["dApps", "Smart Contracts"]},
        demo_mode=None
    )
    check("Complete research verified -> PASS", att_res_good["verified"] is True)

    att_res_bad = await verifier.verify(
        task_id="task-test-06",
        task_type="research",
        task_description="Research Web3",
        worker_agent_id="agent-research-001",
        worker_result="Short",
        worker_structured_data={"sources": [], "key_points": []},
        demo_mode=None
    )
    check("Incomplete research missing sources -> FAIL", att_res_bad["verified"] is False)

    # Test 6: Asymmetric Reputation Delta Calculations
    # +2 capped at 100
    check("Reputation 80 + 2 = 82", verifier.calculate_new_reputation(80, True) == 82)
    check("Reputation 99 + 2 = 100 (capped)", verifier.calculate_new_reputation(99, True) == 100)
    check("Reputation 100 + 2 = 100 (capped)", verifier.calculate_new_reputation(100, True) == 100)

    # -31 floored at 0
    check("Reputation 80 - 31 = 49", verifier.calculate_new_reputation(80, False) == 49)
    check("Reputation 25 - 31 = 0 (floored)", verifier.calculate_new_reputation(25, False) == 0)
    check("Reputation 0 - 31 = 0 (floored)", verifier.calculate_new_reputation(0, False) == 0)


def test_proof_generator():
    section("5. Proof of Agent Work Generator Tests")
    proof = generate_proof_of_work(
        task_id="task-unit-999",
        agent_id="agent-pricing-001",
        task_type="pricing",
        result="₹59,999",
        verified=True,
        verified_result="₹59,999",
        confidence=96,
        timestamp="2026-09-29T00:00:00Z"
    )

    check("proof_hash is 66 chars (0x + 64 hex)", len(proof["proof_hash"]) == 66)
    check("result_hash is 66 chars", len(proof["result_hash"]) == 66)
    check("verification_hash is 66 chars", len(proof["verification_hash"]) == 66)

    # Determinism: same input must produce exact same SHA-256 hash
    proof_again = generate_proof_of_work(
        task_id="task-unit-999",
        agent_id="agent-pricing-001",
        task_type="pricing",
        result="₹59,999",
        verified=True,
        verified_result="₹59,999",
        confidence=96,
        timestamp="2026-09-29T00:00:00Z"
    )
    check("Deterministic proof hash reproduction", proof["proof_hash"] == proof_again["proof_hash"])

    # Tampering test: changing one character in result must change proof hash
    proof_tampered = generate_proof_of_work(
        task_id="task-unit-999",
        agent_id="agent-pricing-001",
        task_type="pricing",
        result="₹59,998",  # 1 rupee difference
        verified=True,
        verified_result="₹59,999",
        confidence=96,
        timestamp="2026-09-29T00:00:00Z"
    )
    check("Mutation alters proof hash (tamper detection)", proof["proof_hash"] != proof_tampered["proof_hash"])

    # Canonical verification test
    canonical_check = verify_canonical_proof(proof["canonical_proof"], proof["proof_hash"])
    check("verify_canonical_proof validates authentic proof", canonical_check["valid"] is True)

    canonical_tampered_check = verify_canonical_proof(proof_tampered["canonical_proof"], proof["proof_hash"])
    check("verify_canonical_proof rejects mismatched hash", canonical_tampered_check["valid"] is False)

    # 3-Tier Full Audit Test (Authentic)
    audit_valid = audit_full_proof(
        task_id="task-unit-999",
        agent_id="agent-pricing-001",
        task_type="pricing",
        result="₹59,999",
        verified=True,
        verified_result="₹59,999",
        confidence=96,
        timestamp="2026-09-29T00:00:00Z",
        claimed_result_hash=proof["result_hash"],
        claimed_verification_hash=proof["verification_hash"],
        claimed_proof_hash=proof["proof_hash"]
    )
    check("3-Tier audit confirms overall validity", audit_valid["overall_valid"] is True)
    check("3-Tier audit tier 1 result hash valid", audit_valid["tier1_result_hash"]["valid"] is True)
    check("3-Tier audit tier 2 verification hash valid", audit_valid["tier2_verification_hash"]["valid"] is True)
    check("3-Tier audit tier 3 proof hash valid", audit_valid["tier3_proof_hash"]["valid"] is True)

    # 3-Tier Full Audit Test (Tampered Worker Result)
    audit_invalid = audit_full_proof(
        task_id="task-unit-999",
        agent_id="agent-pricing-001",
        task_type="pricing",
        result="₹59,999-TAMPERED",
        verified=True,
        verified_result="₹59,999",
        confidence=96,
        timestamp="2026-09-29T00:00:00Z",
        claimed_result_hash=proof["result_hash"],
        claimed_verification_hash=proof["verification_hash"],
        claimed_proof_hash=proof["proof_hash"]
    )
    check("3-Tier audit detects tampered worker result", audit_invalid["overall_valid"] is False)
    check("3-Tier audit flags tier 1 failure", audit_invalid["tier1_result_hash"]["valid"] is False)


async def test_dynamic_routing_and_unseen_tasks():
    section("6. Orchestrator Intent Classification Tests")
    from database.db import SessionLocal, TaskDB, init_db
    from orchestrator.orchestrator import Orchestrator

    init_db()
    db = SessionLocal()
    orchestrator = Orchestrator(db)

    # 1. Routing classification checks
    c1 = orchestrator.classify_intent("How can I create an effective PowerPoint presentation for my college seminar?")
    check("PowerPoint Seminar -> Research Agent", c1["selected_agent"] == "agent-research-001" and c1["agent_type"] == "research")
    check("PowerPoint Seminar routing has rationale", len(c1["reason"]) > 10)
    check("PowerPoint Seminar confidence >= 90", c1["confidence"] >= 90)

    c2 = orchestrator.classify_intent("Explain neural networks in simple terms.")
    check("Neural Networks -> Research Agent", c2["selected_agent"] == "agent-research-001" and c2["agent_type"] == "research")

    c3 = orchestrator.classify_intent("What are the advantages and disadvantages of cloud computing?")
    check("Cloud Computing Pros/Cons -> Research Agent", c3["selected_agent"] == "agent-research-001")

    c4 = orchestrator.classify_intent("Compare Python and Java for a beginner.")
    check("Python vs Java -> Analysis Agent", c4["selected_agent"] == "agent-analysis-001" and c4["agent_type"] == "analysis")

    c5 = orchestrator.classify_intent("Analyze the following sales numbers: 100, 150, 120, 180.")
    check("Sales Numbers -> Analysis Agent", c5["selected_agent"] == "agent-analysis-001")

    c6 = orchestrator.classify_intent("What is the current price of a smartphone under ₹30,000?")
    check("Phone under ₹30,000 -> Pricing Agent", c6["selected_agent"] == "agent-pricing-001" and c6["agent_type"] == "pricing")

    c7 = orchestrator.classify_intent("How can I prepare for APICET?")
    check("APICET Prep -> Research Agent", c7["selected_agent"] == "agent-research-001")

    c8 = orchestrator.classify_intent("Summarize the following text.")
    check("Summarize Text -> Research Agent", c8["selected_agent"] == "agent-research-001")

    c9 = orchestrator.classify_intent("Calculate the percentage increase from 800 to 1000.")
    check("Math Percentage Increase -> Analysis Agent", c9["selected_agent"] == "agent-analysis-001")

    c10 = orchestrator.classify_intent("Verify whether this research result is correct")
    check("Attestation Request -> Verification Agent", c10["selected_agent"] == "agent-verification-001")

    c_unseen = orchestrator.classify_intent("What are the key benefits and setup steps for hydroponic indoor gardening?")
    check("Unseen Hydroponics -> Research Agent", c_unseen["selected_agent"] == "agent-research-001")

    section("7. Execution & Independent Verification of 10 Unseen Tasks")
    test_tasks = [
        ("How can I create an effective PowerPoint presentation for my college seminar?", "auto"),
        ("Explain neural networks in simple terms.", "auto"),
        ("What are the advantages and disadvantages of cloud computing?", "auto"),
        ("Compare Python and Java for a beginner.", "auto"),
        ("Analyze the following sales numbers: 100, 150, 120, 180.", "auto"),
        ("What is the current price of a smartphone under ₹30,000?", "auto"),
        ("How can I prepare for APICET?", "auto"),
        ("Summarize the following text.", "auto"),
        ("Calculate the percentage increase from 800 to 1000.", "auto"),
        ("What are the key benefits and setup steps for hydroponic indoor gardening?", "auto"),
    ]

    for idx, (prompt, t_type) in enumerate(test_tasks, 1):
        task_id = f"test-eval-{idx}-{uuid.uuid4().hex[:8]}"
        task_record = TaskDB(
            task_id=task_id,
            task_type=t_type,
            description=prompt,
            budget=0.05,
            status="CREATED"
        )
        db.add(task_record)
        db.commit()

        exec_res = await orchestrator.execute_task(task_record)
        check(f"Task {idx} executed successfully", exec_res["status"] in ["PAID", "VERIFIED", "REFUNDED"])
        check(f"Task {idx} preserved original prompt", exec_res["task"] == prompt)
        check(f"Task {idx} routing decision included", "orchestrator" in exec_res and len(exec_res["reason"]) > 0)
        check(f"Task {idx} verification inspected and passed", exec_res["verification"]["verified"] is True)
        check(f"Task {idx} no hardcoded laptop fallback", "laptop x" not in exec_res["result"]["worker_result"].lower() or "laptop x" in prompt.lower())

    db.close()


async def main():
    print("\033[1m\033[96m============================================================\033[0m")
    print("\033[1m\033[96m  TrustMesh — Agent Execution Engine Comprehensive Tests   \033[0m")
    print("\033[1m\033[96m============================================================\033[0m")

    await test_pricing_agent()
    await test_research_agent()
    await test_analysis_agent()
    await test_verification_agent()
    test_proof_generator()
    await test_dynamic_routing_and_unseen_tasks()

    print("\n\033[1m\033[96m============================================================\033[0m")
    print(f"\033[1m  TOTAL: \033[92m{passed} passed\033[0m / \033[91m{failed} failed\033[0m / {passed+failed} total\033[0m")
    print("\033[1m\033[96m============================================================\033[0m\n")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
