"""
TrustMesh — Orchestrator
=========================
The brain of TrustMesh. Routes tasks dynamically to appropriate agents
based on natural language intent understanding, manages the full execution
workflow, records cryptographic Proof of Agent Work, and coordinates settlement.

Full workflow:
1. Receive task (natural language prompt)
2. Dynamically classify intent & select appropriate specialized agent
3. Assign and execute task off-chain
4. Send result to independent Verification Agent
5. Generate Proof of Agent Work (canonical root hash)
6. Record on MST Blockchain
7. Update reputation (asymmetric penalty/reward)
8. Process payment (escrow release or refund)
9. Return complete verifiable result
"""

import uuid
import re
from datetime import datetime, UTC
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from agents.pricing_agent import PricingAgent
from agents.research_agent import ResearchAgent
from agents.analysis_agent import AnalysisAgent
from agents.verification_agent import VerificationAgent
from proof.proof_generator import generate_proof_of_work
from database.db import AgentDB, TaskDB, ProofDB, ReputationHistoryDB


class Orchestrator:
    """
    Orchestrator — dynamically understands user tasks, selects agents,
    manages the trust pipeline, and records verifiable execution.
    """

    def __init__(self, db: Session):
        self.db = db
        # Initialize all specialized agents
        self.verification_agent = VerificationAgent()
        self.agents = {
            "research": ResearchAgent(),
            "pricing": PricingAgent(),
            "analysis": AnalysisAgent(),
            "verification": self.verification_agent,
            "general": ResearchAgent()
        }

        # Try to initialize MST Blockchain client
        self.mst_client = None
        try:
            from blockchain.mst_client import get_mst_client
            self.mst_client = get_mst_client()
        except Exception as e:
            print(f"[WARN] MST Client not available: {e}")

    def classify_intent(self, task_description: str) -> dict:
        """
        Dynamically classify natural language task intent and route to the appropriate agent.
        Does NOT rely on exact-question matching or fixed demo topic whitelists.

        Returns:
            {
                "task": task_description,
                "selected_agent": "agent-id",
                "agent_name": "Agent Name",
                "agent_type": "research" | "pricing" | "analysis" | "verification",
                "reason": "Clear explanation of classification",
                "confidence": 0-100
            }
        """
        desc = (task_description or "").strip()
        desc_lower = desc.lower()

        # -------------------------------------------------------------
        # 1. Verification Intent
        # Explicit request to verify, audit proof, or check accuracy of a claim/result
        # -------------------------------------------------------------
        verification_patterns = [
            r"\b(verify|attest|attestation|audit proof|validate whether|validate that)\b",
            r"\b(check whether.*correct|check if.*correct|is (this|the) (result|output|data) correct)\b",
            r"\b(confirm whether.*accurate|verify correctness)\b",
        ]
        if any(re.search(p, desc_lower) for p in verification_patterns):
            return {
                "task": desc,
                "selected_agent": "agent-verification-001",
                "agent_name": "Verification Agent",
                "agent_type": "verification",
                "reason": "This task requests independent attestation, proof validation, or verification of an existing result.",
                "confidence": 96
            }

        # -------------------------------------------------------------
        # 2. Pricing Intent
        # Price discovery, product valuation, market quotes, deals, budget checks
        # -------------------------------------------------------------
        pricing_patterns = [
            r"[₹$€£]",
            r"\b(price|pricing|cost|how much (is|does|are|do)|cheap(est)?|expensive|discount|quote|deals? on)\b",
            r"\bunder (₹|rs\.?|\$)?\s*\d+",
            r"\b(budget under|less than (₹|rs\.?|\$)?\s*\d+|price of|compare prices?)\b",
            r"\b(market valuation of|retail price)\b"
        ]
        is_explicit_calculation = bool(re.search(
            r"\b(calculate|percentage increase|percentage decrease|percentage change|percentage between|percentage from)\b",
            desc_lower
        ))

        if any(re.search(p, desc_lower) for p in pricing_patterns) and not is_explicit_calculation:
            if not ("analyze" in desc_lower and "trend" in desc_lower and not ("under" in desc_lower or "price of" in desc_lower)):
                return {
                    "task": desc,
                    "selected_agent": "agent-pricing-001",
                    "agent_name": "Pricing Agent",
                    "agent_type": "pricing",
                    "reason": "This task involves product pricing discovery, valuation, market quote, or budget constraint verification.",
                    "confidence": 95
                }

        # -------------------------------------------------------------
        # 3. Analysis Intent
        # Mathematical computation, statistical processing of numbers, multi-factor comparison
        # -------------------------------------------------------------
        math_patterns = [
            r"\b(calculate|percentage increase|percentage decrease|percentage change|compute|formula|arithmetic|equation)\b",
            r"\bpercentage.*(increase|decrease|from|between|to)\b",
            r"\b\d+([.,]\d+)?%\s*(increase|decrease|growth)\b"
        ]
        data_series_pattern = r"\b\d+([.,]\d+)?(\s*,\s*\d+([.,]\d+)?){2,}\b"
        data_analysis_patterns = [
            r"\b(analyze.*(data|numbers?|sales|dataset|metrics|distribution|trend)|sales numbers?|sales data)\b",
            r"\b(evaluate performance of|statistical analysis)\b"
        ]
        comparison_patterns = [
            r"\b(compare|comparison|\bvs\b|versus|difference between|trade-?offs between)\b",
            r"\bpros and cons of .* and \b"
        ]

        if any(re.search(p, desc_lower) for p in math_patterns):
            return {
                "task": desc,
                "selected_agent": "agent-analysis-001",
                "agent_name": "Analysis Agent",
                "agent_type": "analysis",
                "reason": "This task involves mathematical computation, quantitative formula evaluation, or percentage change calculation.",
                "confidence": 95
            }

        if re.search(data_series_pattern, desc) or any(re.search(p, desc_lower) for p in data_analysis_patterns):
            return {
                "task": desc,
                "selected_agent": "agent-analysis-001",
                "agent_name": "Analysis Agent",
                "agent_type": "analysis",
                "reason": "This task requires quantitative dataset processing, statistical computation, and numerical metric evaluation.",
                "confidence": 94
            }

        if any(re.search(p, desc_lower) for p in comparison_patterns):
            return {
                "task": desc,
                "selected_agent": "agent-analysis-001",
                "agent_name": "Analysis Agent",
                "agent_type": "analysis",
                "reason": "This task requires comparative evaluation, trade-off analysis, and multi-factor technical contrast.",
                "confidence": 92
            }

        if "analyze" in desc_lower:
            return {
                "task": desc,
                "selected_agent": "agent-analysis-001",
                "agent_name": "Analysis Agent",
                "agent_type": "analysis",
                "reason": "This task requires structured analytical assessment, root cause investigation, or risk evaluation.",
                "confidence": 88
            }

        # -------------------------------------------------------------
        # 4. Research / General Intent (and default fallback)
        # Informational synthesis, presentations, explanations, prep guides, summaries
        # -------------------------------------------------------------
        research_patterns = [
            r"\b(how (can|should|do|to)|guide|steps to|tips for|best practices|create an? (effective|good))\b",
            r"\b(explain|what is|what are|overview of|introduction to|teach me|fundamentals of)\b",
            r"\b(prepare for|preparation|exam|syllabus|apicet|test prep|study guide)\b",
            r"\b(summarize|summary|synthesize|literature|research|trends in|history of)\b",
            r"\b(advantages and disadvantages|pros and cons|benefits and risks)\b"
        ]

        if any(re.search(p, desc_lower) for p in research_patterns):
            return {
                "task": desc,
                "selected_agent": "agent-research-001",
                "agent_name": "Research Agent",
                "agent_type": "research",
                "reason": "This task requires informational research, domain synthesis, and structured guidance.",
                "confidence": 92
            }

        # General/Unseen query fallback -> Research Agent
        return {
            "task": desc,
            "selected_agent": "agent-research-001",
            "agent_name": "Research Agent",
            "agent_type": "research",
            "reason": "This general task requires informational research and exploratory domain synthesis.",
            "confidence": 80
        }

    async def execute_task(self, task: TaskDB) -> dict:
        """
        Execute the complete TrustMesh workflow for a task.

        Pipeline:
        Dynamic Routing -> Agent Execution -> Verification Agent -> Proof -> Blockchain -> Payment -> Reputation
        """
        steps = []

        # ----------------------------------------
        # STEP 1: Update task status to EXECUTING
        # ----------------------------------------
        task.status = "EXECUTING"
        steps.append({
            "step": "TASK_EXECUTING",
            "message": "Task accepted by orchestrator",
            "timestamp": datetime.now(UTC).isoformat()
        })

        # ----------------------------------------
        # STEP 2: Task Intent Classification & Dynamic Routing
        # ----------------------------------------
        classification = self.classify_intent(task.description)
        is_auto = task.task_type in [None, "", "auto", "general", "AUTO", "GENERAL"]

        if is_auto:
            target_task_type = classification["agent_type"]
            task.task_type = target_task_type
        else:
            target_task_type = task.task_type

        steps.append({
            "step": "INTENT_CLASSIFIED",
            "message": f"Orchestrator classified task intent: {classification['agent_name']} selected",
            "task": task.description,
            "selected_agent": classification["selected_agent"],
            "agent_name": classification["agent_name"],
            "agent_type": target_task_type,
            "reason": classification["reason"],
            "confidence": classification["confidence"],
            "timestamp": datetime.now(UTC).isoformat()
        })

        # Resolve specialized agent worker
        agent = self.agents.get(target_task_type)
        if not agent:
            # Fallback to research agent if target type is unmapped
            agent = self.agents.get("research")
            target_task_type = "research"
            task.task_type = "research"

        # Check if user specified a preferred agent
        agent_db = None
        if task.assigned_agent_id:
            preferred = self.db.query(AgentDB).filter(AgentDB.agent_id == task.assigned_agent_id).first()
            if preferred:
                agent_db = preferred
                target_task_type = preferred.agent_type
                task.task_type = target_task_type
                agent = self.agents.get(target_task_type, self.agents.get("research"))

        # Otherwise get highest-reputation agent from database for this type
        if not agent_db:
            agent_db = self.db.query(AgentDB).filter(
                AgentDB.agent_type == target_task_type,
                AgentDB.status == "ACTIVE"
            ).order_by(AgentDB.reputation.desc()).first()

        if not agent_db:
            # Fallback to any agent of this type
            agent_db = self.db.query(AgentDB).filter(
                AgentDB.agent_type == target_task_type
            ).order_by(AgentDB.reputation.desc()).first()
            if agent_db:
                agent_db.status = "ACTIVE"
                if agent_db.reputation < 50:
                    agent_db.reputation = 75
                self.db.commit()

        if not agent_db:
            task.status = "FAILED"
            raise ValueError(f"No agent found for type: {target_task_type}")

        task.assigned_agent_id = agent_db.agent_id
        steps.append({
            "step": "AGENT_SELECTED",
            "message": f"Selected {agent_db.name} (reputation: {agent_db.reputation})",
            "agent_id": agent_db.agent_id,
            "agent_name": agent_db.name,
            "timestamp": datetime.now(UTC).isoformat()
        })

        # ----------------------------------------
        # STEP 3: Execute the task dynamically
        # ----------------------------------------
        agent_output = await agent.execute(
            task_description=task.description,
            demo_mode=task.demo_mode
        )

        task.agent_result = agent_output["result"]
        steps.append({
            "step": "RESULT_RECEIVED",
            "message": f"Agent returned result: {agent_output['result'][:120]}...",
            "result": agent_output["result"],
            "confidence": agent_output.get("confidence", 0),
            "timestamp": datetime.now(UTC).isoformat()
        })

        # ----------------------------------------
        # STEP 4: Send to Verification Agent
        # ----------------------------------------
        task.status = "VERIFICATION_PENDING"
        steps.append({
            "step": "VERIFYING",
            "message": "Sending result to independent Verification Agent for inspection",
            "timestamp": datetime.now(UTC).isoformat()
        })

        verification_result = await self.verification_agent.verify(
            task_id=task.task_id,
            task_type=target_task_type,
            task_description=task.description,
            worker_agent_id=agent_db.agent_id,
            worker_result=agent_output["result"],
            worker_structured_data=agent_output.get("structured_data", {}),
            demo_mode=task.demo_mode
        )

        # Save verification results
        task.verified = verification_result["verified"]
        task.verification_reason = verification_result["reason"]
        task.verification_confidence = verification_result["confidence"]
        task.verified_result = verification_result["verified_result"]

        steps.append({
            "step": "VERIFICATION_COMPLETED",
            "message": f"Verification {'PASSED' if verification_result['verified'] else 'FAILED'}: {verification_result['reason']}",
            "verified": verification_result["verified"],
            "reason": verification_result["reason"],
            "confidence": verification_result["confidence"],
            "timestamp": datetime.now(UTC).isoformat()
        })

        # ----------------------------------------
        # STEP 5: Generate Proof of Agent Work
        # ----------------------------------------
        timestamp = datetime.now(UTC).isoformat()
        proof_data = generate_proof_of_work(
            task_id=task.task_id,
            agent_id=agent_db.agent_id,
            task_type=target_task_type,
            result=agent_output["result"],
            verified=verification_result["verified"],
            verified_result=verification_result["verified_result"],
            confidence=verification_result["confidence"],
            timestamp=timestamp
        )

        task.proof_hash = proof_data["proof_hash"]
        task.result_hash = proof_data["result_hash"]

        steps.append({
            "step": "PROOF_GENERATED",
            "message": "Cryptographic Proof of Agent Work generated",
            "proof_hash": proof_data["proof_hash"],
            "result_hash": proof_data["result_hash"],
            "timestamp": datetime.now(UTC).isoformat()
        })

        # ----------------------------------------
        # STEP 6: Record on MST Blockchain
        # ----------------------------------------
        blockchain_tx_hash = None
        blockchain_recorded = False

        if self.mst_client and self.mst_client.is_connected():
            blockchain_tx_hash = self.mst_client.record_proof_on_chain(
                task_id=task.task_id,
                agent_id=agent_db.agent_id,
                proof_hash=proof_data["proof_hash"],
                verified=verification_result["verified"],
                agent_wallet=agent_db.wallet_address,
                result_hash=proof_data["result_hash"],
                verification_hash=proof_data["verification_hash"]
            )
            if blockchain_tx_hash:
                blockchain_recorded = True

        task.blockchain_tx_hash = blockchain_tx_hash
        task.blockchain_recorded = blockchain_recorded

        if blockchain_recorded:
            steps.append({
                "step": "BLOCKCHAIN_RECORDED",
                "message": "Trust event recorded on MST Blockchain",
                "tx_hash": blockchain_tx_hash,
                "timestamp": datetime.now(UTC).isoformat()
            })
        else:
            steps.append({
                "step": "BLOCKCHAIN_PENDING",
                "message": "Blockchain record prepared (MST Testnet)",
                "timestamp": datetime.now(UTC).isoformat()
            })

        # ----------------------------------------
        # STEP 7: Update Reputation (Prevent Duplicate Updates)
        # ----------------------------------------
        existing_rep_event = self.db.query(ReputationHistoryDB).filter(
            ReputationHistoryDB.task_id == task.task_id
        ).first()

        if existing_rep_event:
            reputation_before = existing_rep_event.reputation_before
            new_reputation = existing_rep_event.reputation_after
        else:
            reputation_before = agent_db.reputation
            new_reputation = self.verification_agent.calculate_new_reputation(
                current_reputation=reputation_before,
                verified=verification_result["verified"],
                verification_status=verification_result.get("status")
            )

            task.reputation_before = reputation_before
            task.reputation_after = new_reputation

            # Update agent in database
            agent_db.reputation = new_reputation
            agent_db.tasks_completed += 1
            if verification_result["verified"]:
                agent_db.tasks_verified += 1

            # Mark agent as UNTRUSTED if reputation drops below threshold
            if new_reputation < 40:
                agent_db.status = "UNTRUSTED"

            # Try to update reputation on chain
            if self.mst_client and self.mst_client.is_connected():
                self.mst_client.update_reputation_on_chain(
                    agent_wallet=agent_db.wallet_address,
                    task_id=task.task_id,
                    success=verification_result["verified"],
                    agent_id=agent_db.agent_id
                )

            # Record reputation history event
            delta = new_reputation - reputation_before
            reason = "Task verification passed (+2)" if verification_result["verified"] else f"Task verification failed (-31): {str(verification_result.get('reason', ''))[:120]}"
            history_entry = ReputationHistoryDB(
                agent_id=agent_db.agent_id,
                task_id=task.task_id,
                reputation_before=reputation_before,
                reputation_after=new_reputation,
                delta=delta,
                reason=reason,
                timestamp=datetime.now(UTC),
                blockchain_tx_hash=blockchain_tx_hash
            )
            self.db.add(history_entry)

        steps.append({
            "step": "REPUTATION_UPDATED",
            "message": f"Agent reputation: {reputation_before} → {new_reputation}",
            "reputation_before": reputation_before,
            "reputation_after": new_reputation,
            "timestamp": datetime.now(UTC).isoformat()
        })

        # ----------------------------------------
        # STEP 8: Process Payment
        # ----------------------------------------
        if verification_result["verified"]:
            payment_status = "RELEASED"
            task.status = "PAID"
            steps.append({
                "step": "PAYMENT_RELEASED",
                "message": f"Payment of {task.budget} tMSTC released to agent",
                "amount": task.budget,
                "timestamp": datetime.now(UTC).isoformat()
            })
        else:
            payment_status = "BLOCKED"
            task.status = "REFUNDED"
            steps.append({
                "step": "PAYMENT_BLOCKED",
                "message": f"Payment BLOCKED — verification failed. {task.budget} tMSTC refunded.",
                "amount": task.budget,
                "timestamp": datetime.now(UTC).isoformat()
            })

        task.payment_status = payment_status
        task.completed_at = datetime.now(UTC)

        # ----------------------------------------
        # STEP 9: Save Proof Record
        # ----------------------------------------
        proof_record = ProofDB(
            proof_id=str(uuid.uuid4()),
            task_id=task.task_id,
            agent_id=agent_db.agent_id,
            task_type=target_task_type,
            result_hash=proof_data["result_hash"],
            verified=verification_result["verified"],
            verification_hash=proof_data["verification_hash"],
            proof_hash=proof_data["proof_hash"],
            timestamp=timestamp,
            blockchain_tx_hash=blockchain_tx_hash,
            blockchain_recorded=blockchain_recorded
        )
        self.db.add(proof_record)

        # ----------------------------------------
        # RETURN COMPLETE RESULT WITH ORCHESTRATOR METADATA
        # ----------------------------------------
        return {
            # Core task preservation
            "task_id": task.task_id,
            "task": task.description,
            "task_type": target_task_type,
            "description": task.description,
            "status": task.status,
            "demo_mode": task.demo_mode,

            # Orchestrator routing output (Explicitly requested by user)
            "selected_agent": agent_db.agent_id,
            "reason": classification["reason"],
            "confidence": classification["confidence"],
            "orchestrator": {
                "task": task.description,
                "selected_agent": agent_db.name,
                "agent_id": agent_db.agent_id,
                "agent_type": target_task_type,
                "reason": classification["reason"],
                "confidence": classification["confidence"]
            },

            # Workflow execution trail
            "workflow": steps,

            # Agent info
            "agent": {
                "agent_id": agent_db.agent_id,
                "agent_name": agent_db.name,
                "agent_type": agent_db.agent_type,
                "wallet": agent_db.wallet_address,
            },

            # Result
            "result": {
                "worker_result": agent_output["result"],
                "verified_result": verification_result["verified_result"],
                "structured_data": agent_output.get("structured_data", {}),
            },

            # Verification
            "verification": {
                "verified": verification_result["verified"],
                "reason": verification_result["reason"],
                "confidence": verification_result["confidence"],
                "verifier_id": verification_result["verification_agent_id"],
                "verification_agent_id": verification_result["verification_agent_id"],
                "verified_result": verification_result["verified_result"],
            },

            # Proof of Agent Work
            "proof": {
                "proof_hash": proof_data["proof_hash"],
                "result_hash": proof_data["result_hash"],
                "verification_hash": proof_data["verification_hash"],
            },

            # Blockchain
            "blockchain": {
                "recorded": blockchain_recorded,
                "tx_hash": blockchain_tx_hash,
                "network": "MST Testnet",
                "explorer_url": f"https://mstscan.com/tx/{blockchain_tx_hash}" if blockchain_tx_hash else None,
                "status": "CONFIRMED" if blockchain_recorded else "PENDING_DEPLOYMENT"
            },

            # Reputation
            "reputation": {
                "before": reputation_before,
                "after": new_reputation,
                "change": new_reputation - reputation_before,
            },

            # Payment
            "payment": {
                "status": payment_status,
                "amount": task.budget,
                "currency": "tMSTC",
            }
        }
