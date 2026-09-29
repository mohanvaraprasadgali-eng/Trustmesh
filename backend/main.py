"""
TrustMesh Backend — FastAPI Main Application
=============================================
Entry point for the TrustMesh backend API.

Architecture:
- FastAPI handles HTTP requests
- SQLite stores off-chain application data
- Agents handle AI task execution
- Orchestrator routes tasks to correct agents
- Verification Agent independently checks results
- Proof Generator creates cryptographic proof
- MST Blockchain Client records trust events on-chain
"""

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, UTC

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Local imports
from database.db import init_db, get_db, AgentDB, TaskDB, ProofDB, ReputationHistoryDB
from models.models import (
    TaskCreateRequest, TaskResponse,
    AgentRegisterRequest, AgentResponse,
    HealthResponse, ProofRecord, StandaloneVerifyRequest, ProofAuditRequest,
    ReputationSimulationRequest, ReputationSimulationResponse, ReputationSimulationStep
)

# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    print("[START] TrustMesh Backend starting...")
    # Initialize database (creates tables if they don't exist)
    init_db()
    # Seed default agents if database is empty
    _seed_default_agents()
    print("[OK] TrustMesh Backend ready")
    yield
    print("[STOP] TrustMesh Backend shutting down")


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="TrustMesh API",
    description="Trust Layer for Autonomous AI Agents — MST Blockchain Hackathon",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow frontend to call backend
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SEED DEFAULT AGENTS
# ============================================================

def _seed_default_agents():
    """
    Pre-register the four core TrustMesh agents.
    This runs on startup so the demo works immediately.
    """
    from database.db import SessionLocal
    db = SessionLocal()
    try:
        # Only seed if no agents exist
        if db.query(AgentDB).count() > 0:
            return

        default_agents = [
            {
                "agent_id": "agent-research-001",
                "name": "Research Agent",
                "agent_type": "research",
                "wallet_address": "0x1111111111111111111111111111111111111111",
                "reputation": 88,
                "tasks_completed": 42,
                "tasks_verified": 40,
                "status": "ACTIVE",
            },
            {
                "agent_id": "agent-pricing-001",
                "name": "Pricing Agent",
                "agent_type": "pricing",
                "wallet_address": "0x2222222222222222222222222222222222222222",
                "reputation": 92,
                "tasks_completed": 24,
                "tasks_verified": 23,
                "status": "ACTIVE",
            },
            {
                "agent_id": "agent-analysis-001",
                "name": "Analysis Agent",
                "agent_type": "analysis",
                "wallet_address": "0x3333333333333333333333333333333333333333",
                "reputation": 85,
                "tasks_completed": 31,
                "tasks_verified": 28,
                "status": "ACTIVE",
            },
            {
                "agent_id": "agent-verification-001",
                "name": "Verification Agent",
                "agent_type": "verification",
                "wallet_address": "0x4444444444444444444444444444444444444444",
                "reputation": 97,
                "tasks_completed": 97,
                "tasks_verified": 97,
                "status": "ACTIVE",
            },
        ]

        for agent_data in default_agents:
            agent = AgentDB(**agent_data)
            db.add(agent)

        db.commit()
        print("[OK] Default agents seeded into database")

    except Exception as e:
        print(f"[WARN] Could not seed agents: {e}")
        db.rollback()
    finally:
        db.close()


# ============================================================
# HEALTH ENDPOINT
# ============================================================

@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint.
    Returns backend status and blockchain connection status.
    """
    # Check database
    db_ok = False
    agents_count = 0
    try:
        agents_count = db.query(AgentDB).count()
        db_ok = True
    except Exception:
        pass

    # Check blockchain connection (Phase 9 — not yet connected)
    blockchain_connected = False
    blockchain_network = None

    # Try to connect to MST Blockchain
    try:
        from blockchain.mst_client import get_mst_client
        client = get_mst_client()
        if client.is_connected():
            blockchain_connected = True
            blockchain_network = f"MST Testnet (Chain ID: {client.chain_id})"
    except Exception:
        pass

    return HealthResponse(
        status="ok",
        blockchain_connected=blockchain_connected,
        blockchain_network=blockchain_network,
        agents_registered=agents_count,
        database_ok=db_ok
    )


# ============================================================
# AGENT ENDPOINTS
# ============================================================

@app.get("/api/agents", tags=["Agents"])
async def get_agents(db: Session = Depends(get_db)):
    """Get all registered agents."""
    agents = db.query(AgentDB).all()
    result = []
    for agent in agents:
        total = agent.tasks_completed or 1
        verification_rate = round((agent.tasks_verified / total) * 100, 1)
        result.append({
            "agent_id": agent.agent_id,
            "name": agent.name,
            "agent_type": agent.agent_type,
            "wallet_address": agent.wallet_address,
            "reputation": agent.reputation,
            "tasks_completed": agent.tasks_completed,
            "tasks_verified": agent.tasks_verified,
            "verification_rate": verification_rate,
            "status": agent.status,
            "registered_at": agent.registered_at.isoformat() if agent.registered_at else "",
            "blockchain_registered": agent.blockchain_registered,
            "blockchain_tx_hash": agent.blockchain_tx_hash
        })
    return {"agents": result, "total": len(result)}


@app.get("/api/agents/{agent_id}", tags=["Agents"])
async def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Get a specific agent by ID."""
    agent = db.query(AgentDB).filter(AgentDB.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    total = agent.tasks_completed or 1
    return {
        "agent_id": agent.agent_id,
        "name": agent.name,
        "agent_type": agent.agent_type,
        "wallet_address": agent.wallet_address,
        "reputation": agent.reputation,
        "tasks_completed": agent.tasks_completed,
        "tasks_verified": agent.tasks_verified,
        "verification_rate": round((agent.tasks_verified / total) * 100, 1),
        "status": agent.status,
        "registered_at": agent.registered_at.isoformat() if agent.registered_at else "",
        "blockchain_registered": agent.blockchain_registered,
        "blockchain_tx_hash": agent.blockchain_tx_hash
    }


@app.get("/api/agents/{agent_id}/history", tags=["Agents"])
async def get_agent_reputation_history(agent_id: str, db: Session = Depends(get_db)):
    """Get the chronological reputation history log for a specific agent."""
    agent = db.query(AgentDB).filter(AgentDB.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    events = db.query(ReputationHistoryDB).filter(
        ReputationHistoryDB.agent_id == agent_id
    ).order_by(ReputationHistoryDB.timestamp.desc()).all()

    return {
        "agent_id": agent_id,
        "agent_name": agent.name,
        "current_reputation": agent.reputation,
        "total_events": len(events),
        "history": [
            {
                "id": ev.id,
                "task_id": ev.task_id,
                "reputation_before": ev.reputation_before,
                "reputation_after": ev.reputation_after,
                "delta": ev.delta,
                "reason": ev.reason,
                "timestamp": ev.timestamp.isoformat() if ev.timestamp else "",
                "blockchain_tx_hash": ev.blockchain_tx_hash
            }
            for ev in events
        ]
    }


# ============================================================
# REPUTATION ENGINE ENDPOINTS
# ============================================================

@app.get("/api/reputation/rules", tags=["Reputation"])
async def get_reputation_rules():
    """
    Get the authoritative mathematical reputation rules mirroring ReputationRegistry.sol:
    - Initial Score: 80
    - Passing Verification: +2
    - Failing Verification: -31 (asymmetric penalty)
    - Untrusted Threshold: 40
    - Recovery Ratio: 16 consecutive passes needed to offset 1 failure
    """
    return {
        "initial_reputation": 80,
        "bonus_on_pass": 2,
        "penalty_on_fail": 31,
        "untrusted_threshold": 40,
        "max_reputation": 100,
        "min_reputation": 0,
        "recovery_tasks_needed": 16,
        "asymmetry_ratio": "15.5x penalty to reward ratio",
        "description": "TrustMesh implements asymmetric reputation where dishonest work is penalized 15.5x more severely than honest work is rewarded."
    }


@app.get("/api/reputation/leaderboard", tags=["Reputation"])
async def get_reputation_leaderboard(db: Session = Depends(get_db)):
    """
    Get ranked leaderboard of all autonomous agents sorted by reputation score.
    Includes trust tiers: TRUSTED (80-100), PROBATION (40-79), UNTRUSTED (0-39).
    """
    agents = db.query(AgentDB).order_by(AgentDB.reputation.desc()).all()
    leaderboard = []

    for rank, agent in enumerate(agents, 1):
        if agent.reputation >= 80:
            tier = "TRUSTED"
        elif agent.reputation >= 40:
            tier = "PROBATION"
        else:
            tier = "UNTRUSTED"

        rate = (agent.tasks_verified / agent.tasks_completed * 100.0) if agent.tasks_completed > 0 else 100.0

        leaderboard.append({
            "rank": rank,
            "agent_id": agent.agent_id,
            "name": agent.name,
            "agent_type": agent.agent_type,
            "wallet_address": agent.wallet_address,
            "reputation": agent.reputation,
            "trust_tier": tier,
            "tasks_completed": agent.tasks_completed,
            "tasks_verified": agent.tasks_verified,
            "verification_rate": round(rate, 1),
            "status": agent.status
        })

    return {
        "total_agents": len(leaderboard),
        "leaderboard": leaderboard
    }


@app.post("/api/reputation/simulate", response_model=ReputationSimulationResponse, tags=["Reputation"])
async def simulate_reputation(req: ReputationSimulationRequest):
    """
    Simulate the mathematical trajectory of agent reputation under
    an arbitrary sequence of verification passes and failures.
    Demonstrates the asymmetric penalty dynamics (+2 vs -31).
    """
    current = req.starting_reputation
    steps = []
    untrusted_triggered = False

    for idx, action in enumerate(req.sequence, 1):
        before = current
        if action == "pass":
            delta = 2
            current = min(100, current + 2)
            note = f"Verification passed: +2 bonus (capped at 100)"
        else:
            delta = -31
            current = max(0, current - 31)
            note = f"Verification failed: -31 asymmetric penalty (floored at 0)"

        if current < 40:
            untrusted_triggered = True
            status = "UNTRUSTED"
            note += " -> AGENT FLAGGED UNTRUSTED (< 40)"
        elif current < 80:
            status = "PROBATION"
        else:
            status = "TRUSTED"

        steps.append(ReputationSimulationStep(
            step=idx,
            action=action,
            reputation_before=before,
            reputation_after=current,
            delta=delta,
            status=status,
            note=note
        ))

    return ReputationSimulationResponse(
        starting_reputation=req.starting_reputation,
        final_reputation=current,
        net_change=current - req.starting_reputation,
        untrusted_triggered=untrusted_triggered,
        recovery_tasks_needed_from_single_fail=16,
        steps=steps
    )


@app.post("/api/agents/register", tags=["Agents"])
async def register_agent(request: AgentRegisterRequest, db: Session = Depends(get_db)):
    """Register a new agent (off-chain + on-chain)."""
    # Validate required fields
    if not request.agent_id or not request.agent_id.strip():
        raise HTTPException(status_code=400, detail="Agent ID is required and cannot be empty")
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="Agent name is required and cannot be empty")

    agent_id = request.agent_id.strip()
    name = request.name.strip()
    wallet_addr = request.wallet_address.strip()

    # Check if already exists
    existing = db.query(AgentDB).filter(AgentDB.agent_id == agent_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Agent ID already exists")

    # Validate wallet address format (0x + 40 hex chars)
    if not wallet_addr.startswith("0x") or len(wallet_addr) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address format. Must be 0x followed by 40 hexadecimal characters.")
    try:
        int(wallet_addr, 16)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid wallet address characters. Must be hexadecimal.")

    # Create in database
    agent = AgentDB(
        agent_id=request.agent_id,
        name=request.name,
        agent_type=request.agent_type.value,
        wallet_address=request.wallet_address,
        metadata_uri=request.metadata_uri or "",
        reputation=80,
        tasks_completed=0,
        tasks_verified=0,
        status="ACTIVE",
    )
    db.add(agent)
    db.commit()

    # Try to register on MST Blockchain
    blockchain_tx_hash = None
    blockchain_registered = False

    # 1. If already broadcast on-chain by user's wallet (BridgeKey / MetaMask in MST_TESTNET mode)
    if request.blockchain_tx_hash and request.blockchain_tx_hash.startswith("0x"):
        blockchain_tx_hash = request.blockchain_tx_hash
        blockchain_registered = True
        agent.blockchain_registered = True
        agent.blockchain_tx_hash = request.blockchain_tx_hash
        db.commit()
    else:
        # 2. Otherwise try backend-signed registration if contracts and backend wallet are configured
        try:
            from blockchain.mst_client import get_mst_client
            client = get_mst_client()
            if client.is_connected() and client.has_contracts():
                tx = client.register_agent_on_chain(
                    agent_id=request.agent_id,
                    agent_type=request.agent_type.value,
                    wallet_address=request.wallet_address,
                    metadata_uri=request.metadata_uri or ""
                )
                if tx:
                    blockchain_tx_hash = tx
                    blockchain_registered = True
                    agent.blockchain_registered = True
                    agent.blockchain_tx_hash = tx
                    db.commit()
                    # Also initialize reputation on-chain
                    client.initialize_agent_reputation(request.agent_id)
        except Exception as e:
            print(f"[WARN] On-chain registration failed: {e}")

    return {
        "success": True,
        "agent_id": request.agent_id,
        "message": "Agent registered" + (" (on-chain + off-chain)" if blockchain_registered else " (off-chain). Fund wallet & deploy contracts for on-chain registration."),
        "blockchain_registered": blockchain_registered,
        "blockchain_tx_hash": blockchain_tx_hash
    }


# ============================================================
# TASK ENDPOINTS
# ============================================================

@app.get("/api/tasks", tags=["Tasks"])
async def get_tasks(db: Session = Depends(get_db)):
    """Get all tasks."""
    tasks = db.query(TaskDB).order_by(TaskDB.created_at.desc()).limit(50).all()
    return {"tasks": [_task_to_dict(t) for t in tasks], "total": len(tasks)}


@app.post("/api/tasks", tags=["Tasks"])
async def create_task(request: TaskCreateRequest, db: Session = Depends(get_db)):
    """Create a new task and begin execution workflow."""
    if not request.description or not request.description.strip():
        raise HTTPException(status_code=400, detail="Task description cannot be empty")
    if request.budget <= 0:
        raise HTTPException(status_code=400, detail="Budget must be greater than zero")

    # Validate preferred agent if specified
    assigned_agent = None
    if request.preferred_agent_id and request.preferred_agent_id.strip():
        ag_id = request.preferred_agent_id.strip()
        ag = db.query(AgentDB).filter(AgentDB.agent_id == ag_id).first()
        if not ag:
            raise HTTPException(status_code=400, detail=f"Preferred agent '{ag_id}' does not exist")
        assigned_agent = ag.agent_id

    # Generate unique task ID
    task_id = f"task-{uuid.uuid4().hex[:12]}"

    # Create task in database
    task = TaskDB(
        task_id=task_id,
        task_type=request.task_type.value if hasattr(request.task_type, "value") else str(request.task_type),
        description=request.description.strip(),
        budget=request.budget,
        status="CREATED",
        assigned_agent_id=assigned_agent,
        demo_mode=request.demo_mode
    )
    db.add(task)
    db.commit()

    return {
        "success": True,
        "task_id": task_id,
        "status": "CREATED",
        "assigned_agent_id": assigned_agent,
        "message": "Task created. Call /api/tasks/{task_id}/execute to run it."
    }


@app.get("/api/tasks/{task_id}", tags=["Tasks"])
async def get_task(task_id: str, db: Session = Depends(get_db)):
    """Get a specific task by ID."""
    task = db.query(TaskDB).filter(TaskDB.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return _task_to_dict(task)


@app.post("/api/tasks/{task_id}/execute", tags=["Tasks"])
async def execute_task(task_id: str, db: Session = Depends(get_db)):
    """
    Execute the complete TrustMesh workflow:
    1. Orchestrator selects agent
    2. Agent executes task
    3. Verification Agent checks result
    4. Proof is generated
    5. Blockchain records trust event
    6. Payment is released or blocked
    7. Reputation is updated
    """
    task = db.query(TaskDB).filter(TaskDB.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    if task.status not in ["CREATED", "FUNDED"]:
        raise HTTPException(status_code=400, detail=f"Task cannot be executed in status: {task.status}")

    # Import orchestrator
    from orchestrator.orchestrator import Orchestrator
    orchestrator = Orchestrator(db)

    try:
        result = await orchestrator.execute_task(task)
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Task execution failed: {str(e)}")


@app.get("/api/tasks/{task_id}/proof", tags=["Tasks"])
async def get_task_proof(task_id: str, db: Session = Depends(get_db)):
    """Get the Proof of Agent Work for a task."""
    task = db.query(TaskDB).filter(TaskDB.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    proof = db.query(ProofDB).filter(ProofDB.task_id == task_id).first()
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not generated yet for this task")

    canonical_proof = {
        "agent_id": proof.agent_id,
        "result_hash": proof.result_hash,
        "task_id": proof.task_id,
        "task_type": proof.task_type,
        "timestamp": proof.timestamp,
        "verification_hash": proof.verification_hash,
        "verified": proof.verified
    }

    from proof.proof_generator import hash_data
    computed_hash = hash_data(canonical_proof)
    is_valid = computed_hash.lower() == proof.proof_hash.lower()

    return {
        "proof_id": proof.proof_id,
        "task_id": proof.task_id,
        "agent_id": proof.agent_id,
        "task_type": proof.task_type,
        "result_hash": proof.result_hash,
        "verified": proof.verified,
        "verification_hash": proof.verification_hash,
        "proof_hash": proof.proof_hash,
        "timestamp": proof.timestamp,
        "blockchain_tx_hash": proof.blockchain_tx_hash,
        "blockchain_recorded": proof.blockchain_recorded,
        "canonical_proof": canonical_proof,
        "integrity_verified": is_valid
    }


@app.post("/api/proofs/verify-proof", tags=["Proofs"])
async def verify_proof_hash(req: ProofAuditRequest):
    """
    Directly verify whether a canonical proof structure matches
    an expected proof hash using pure SHA-256 reconstruction.
    """
    from proof.proof_generator import verify_canonical_proof
    return verify_canonical_proof(req.canonical_proof, req.expected_proof_hash)


@app.get("/api/tasks/{task_id}/audit", tags=["Proofs"])
async def audit_task_proof(task_id: str, db: Session = Depends(get_db)):
    """
    Perform a complete 3-Tier cryptographic integrity audit of a task's Proof of Agent Work:
    Tier 1: Result Hash vs Agent Output
    Tier 2: Verification Hash vs Attestation Outcome
    Tier 3: Canonical Proof Hash vs Constituents
    """
    task = db.query(TaskDB).filter(TaskDB.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    proof = db.query(ProofDB).filter(ProofDB.task_id == task_id).first()
    if not proof:
        raise HTTPException(status_code=404, detail=f"Proof not generated yet for task {task_id}")

    from proof.proof_generator import audit_full_proof
    audit_report = audit_full_proof(
        task_id=task.task_id,
        agent_id=task.assigned_agent_id or proof.agent_id,
        task_type=task.task_type,
        result=task.agent_result or "",
        verified=task.verified if task.verified is not None else proof.verified,
        verified_result=task.verified_result or "",
        confidence=task.verification_confidence or 95,
        timestamp=proof.timestamp,
        claimed_result_hash=proof.result_hash,
        claimed_verification_hash=proof.verification_hash,
        claimed_proof_hash=proof.proof_hash
    )
    audit_report["task_id"] = task_id
    audit_report["blockchain_tx_hash"] = proof.blockchain_tx_hash
    audit_report["blockchain_recorded"] = proof.blockchain_recorded
    return audit_report


# ============================================================
# VERIFICATION ENGINE ENDPOINTS
# ============================================================

@app.post("/api/verification/verify", tags=["Verification"])
async def verify_standalone(req: StandaloneVerifyRequest):
    """
    Directly run the Verification Agent on arbitrary task inputs
    without creating or funding an escrow task.
    Allows live verification sandbox testing and attestation generation.
    """
    from agents.verification_agent import VerificationAgent
    verifier = VerificationAgent()
    attestation = await verifier.verify(
        task_id=f"verify-test-{uuid.uuid4().hex[:8]}",
        task_type=req.task_type.value,
        task_description=req.task_description,
        worker_agent_id=req.worker_agent_id or "external-worker",
        worker_result=req.worker_result,
        worker_structured_data=req.worker_structured_data or {},
        demo_mode=req.demo_mode
    )
    return attestation


@app.get("/api/verification/reference-data", tags=["Verification"])
async def get_verification_reference_data():
    """
    Return the Verification Agent's reference database, product catalog,
    and tolerance rules for auditability.
    """
    from agents.verification_agent import VerificationAgent
    verifier = VerificationAgent()
    return verifier.get_reference_catalog()


# ============================================================
# BLOCKCHAIN STATS ENDPOINT
# ============================================================

@app.get("/api/blockchain/stats", tags=["Blockchain"])
async def get_blockchain_stats():
    """
    Get live stats from deployed TrustMesh contracts on MST Blockchain.
    Returns task counts, total volume, and contract addresses.
    """
    try:
        from blockchain.mst_client import get_mst_client
        client = get_mst_client()
        connected = client.is_connected()
        deploy_info = client.get_deployment_info()

        stats = {
            "connected": connected,
            "network": f"MST Testnet (Chain ID: {client.chain_id})" if connected else None,
            "chain_id": client.chain_id,
            "block_number": client.get_block_number(),
            "contracts_deployed": client.has_contracts(),
            "contracts": {
                "agent_registry":      client.agent_registry_address or None,
                "reputation_registry": client.reputation_registry_address or None,
                "task_escrow":         client.task_escrow_address or None,
            },
            "deployment": deploy_info,
            "escrow_stats": client.get_contract_stats() if connected else {}
        }
        return stats
    except Exception as e:
        return {"connected": False, "error": str(e)}


@app.get("/api/transactions", tags=["Blockchain"])
async def get_transactions(db: Session = Depends(get_db)):
    """
    Get all genuine on-chain transactions across agent registrations,
    task proofs, and contract deployments.
    """
    from blockchain.mst_client import get_mst_client
    client = get_mst_client()
    tx_list = []

    # 1. Contract Deployments (from canonical deployments/mst_testnet.json)
    deploy_info = client.get_deployment_info()
    if deploy_info and deploy_info.get("deployed"):
        contracts = deploy_info.get("contracts", {})
        transactions = deploy_info.get("transactions", {})
        for contract_name, tx_hash in transactions.items():
            if tx_hash:
                tx_list.append({
                    "id": f"deploy-{contract_name.lower()}",
                    "type": "CONTRACT_DEPLOYMENT",
                    "contract": contract_name,
                    "contract_address": contracts.get(contract_name),
                    "tx_hash": tx_hash,
                    "reference_id": contract_name,
                    "title": f"Deploy {contract_name}",
                    "block_number": None,
                    "status": "CONFIRMED",
                    "timestamp": deploy_info.get("deployedAt"),
                    "network": "MST Testnet",
                    "chain_id": client.chain_id,
                    "explorer_url": f"https://mstscan.com/tx/{tx_hash}"
                })

    # 2. Agent Registrations
    agents = db.query(AgentDB).filter(AgentDB.blockchain_tx_hash.isnot(None)).all()
    for a in agents:
        tx_list.append({
            "id": f"agent-{a.agent_id}",
            "type": "AGENT_REGISTRATION",
            "agent_id": a.agent_id,
            "contract": "AgentRegistry",
            "tx_hash": a.blockchain_tx_hash,
            "reference_id": a.agent_id,
            "title": f"Register Agent: {a.name}",
            "block_number": None,
            "status": "CONFIRMED",
            "timestamp": a.registered_at.isoformat() if a.registered_at else "",
            "network": "MST Testnet",
            "chain_id": client.chain_id,
            "explorer_url": f"https://mstscan.com/tx/{a.blockchain_tx_hash}"
        })

    # 3. Task Proof Commitments
    tasks = db.query(TaskDB).filter(TaskDB.blockchain_tx_hash.isnot(None)).all()
    for t in tasks:
        tx_list.append({
            "id": f"task-{t.task_id}",
            "type": "PROOF_COMMITMENT",
            "task_id": t.task_id,
            "contract": "TaskEscrow",
            "tx_hash": t.blockchain_tx_hash,
            "reference_id": t.task_id,
            "title": f"Task Proof: {t.task_type.upper()}",
            "block_number": None,
            "status": "CONFIRMED",
            "timestamp": t.completed_at.isoformat() if t.completed_at else (t.created_at.isoformat() if t.created_at else ""),
            "network": "MST Testnet",
            "chain_id": client.chain_id,
            "explorer_url": f"https://mstscan.com/tx/{t.blockchain_tx_hash}"
        })

    return {
        "transactions": tx_list,
        "total": len(tx_list),
        "network": "MST Testnet",
        "chain_id": client.chain_id
    }


@app.get("/api/blockchain/tasks/{task_id}", tags=["Blockchain"])
async def get_blockchain_task_record(task_id: str):
    """
    Query the deployed TaskEscrow smart contract directly on MST Blockchain
    to retrieve the genuine on-chain record for a task.
    """
    try:
        from blockchain.mst_client import get_mst_client
        client = get_mst_client()
        if not client.is_connected():
            raise HTTPException(status_code=503, detail="MST Blockchain not connected")

        record = client.get_task_on_chain(task_id)
        if not record:
            return {
                "task_id": task_id,
                "recorded_on_chain": False,
                "detail": "Task not found on TaskEscrow contract or not yet funded on-chain"
            }
        return {
            "recorded_on_chain": True,
            "contract_address": client.task_escrow_address,
            "network": f"MST Testnet (Chain ID: {client.chain_id})",
            "task": record
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/blockchain/agents/{agent_id}/onchain", tags=["Blockchain"])
async def get_blockchain_agent_record(agent_id: str):
    """
    Query the deployed AgentRegistry and ReputationRegistry smart contracts
    directly on MST Blockchain to verify an agent's on-chain status and reputation.
    """
    try:
        from blockchain.mst_client import get_mst_client
        client = get_mst_client()
        if not client.is_connected():
            raise HTTPException(status_code=503, detail="MST Blockchain not connected")

        is_active = client.is_agent_active_on_chain(agent_id)
        score = client.get_reputation_by_agent_id(agent_id)

        return {
            "agent_id": agent_id,
            "on_chain_active": is_active,
            "on_chain_reputation": score,
            "agent_registry_address": client.agent_registry_address,
            "reputation_registry_address": client.reputation_registry_address,
            "network": f"MST Testnet (Chain ID: {client.chain_id})"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _task_to_dict(task: TaskDB) -> dict:
    """Convert TaskDB to dict for API response."""
    return {
        "task_id": task.task_id,
        "task_type": task.task_type,
        "description": task.description,
        "budget": task.budget,
        "status": task.status,
        "created_at": task.created_at.isoformat() if task.created_at else "",
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "assigned_agent_id": task.assigned_agent_id,
        "agent_result": task.agent_result,
        "verified": task.verified,
        "verification_reason": task.verification_reason,
        "verification_confidence": task.verification_confidence,
        "verified_result": task.verified_result,
        "proof_hash": task.proof_hash,
        "result_hash": task.result_hash,
        "blockchain_tx_hash": task.blockchain_tx_hash,
        "blockchain_recorded": task.blockchain_recorded,
        "reputation_before": task.reputation_before,
        "reputation_after": task.reputation_after,
        "payment_status": task.payment_status,
        "demo_mode": task.demo_mode
    }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
