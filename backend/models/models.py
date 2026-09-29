"""
TrustMesh Backend — Data Models
Defines Pydantic models for API request/response
and SQLAlchemy models for the SQLite database.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime

from enum import Enum


# ============================================================
# ENUMS
# ============================================================

class TaskType(str, Enum):
    RESEARCH = "research"
    PRICING = "pricing"
    ANALYSIS = "analysis"
    VERIFICATION = "verification"
    AUTO = "auto"
    GENERAL = "general"


class TaskStatus(str, Enum):
    CREATED = "CREATED"
    FUNDED = "FUNDED"
    EXECUTING = "EXECUTING"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    PAID = "PAID"
    REFUNDED = "REFUNDED"


class AgentType(str, Enum):
    RESEARCH = "research"
    PRICING = "pricing"
    ANALYSIS = "analysis"
    VERIFICATION = "verification"
    GENERAL = "general"


# ============================================================
# TASK MODELS
# ============================================================

class TaskCreateRequest(BaseModel):
    """Request body when creating a new task"""
    task_type: Optional[TaskType] = TaskType.AUTO
    description: str = Field(..., min_length=10, max_length=1000)
    budget: float = Field(..., gt=0)
    preferred_agent_id: Optional[str] = None
    demo_mode: Optional[Literal["success", "failure"]] = None  # for deterministic demo


class TaskResponse(BaseModel):
    """Response after creating a task"""
    task_id: str
    task_type: str
    description: str
    budget: float
    status: str
    created_at: str
    agent_id: Optional[str] = None
    result: Optional[str] = None
    verification_status: Optional[bool] = None
    proof_hash: Optional[str] = None
    blockchain_tx_hash: Optional[str] = None
    reputation_before: Optional[int] = None
    reputation_after: Optional[int] = None
    payment_status: Optional[str] = None


# ============================================================
# AGENT MODELS
# ============================================================

class AgentRegisterRequest(BaseModel):
    """Request body when registering an agent"""
    agent_id: str
    name: str
    agent_type: AgentType
    wallet_address: str
    metadata_uri: Optional[str] = ""
    blockchain_registered: Optional[bool] = False
    blockchain_tx_hash: Optional[str] = None


class AgentResponse(BaseModel):
    """Agent data returned by API"""
    agent_id: str
    name: str
    agent_type: str
    wallet_address: str
    reputation: int
    tasks_completed: int
    tasks_verified: int
    verification_rate: float
    status: str
    registered_at: str
    blockchain_registered: bool
    blockchain_tx_hash: Optional[str] = None


# ============================================================
# VERIFICATION MODELS
# ============================================================

class VerificationResult(BaseModel):
    """Result of the Verification Agent's independent check"""
    verified: bool
    reason: str
    confidence: int = Field(..., ge=0, le=100)
    proof: str  # The canonical hash of the verification data
    worker_result: str
    verified_result: str
    verification_agent_id: str


class StandaloneVerifyRequest(BaseModel):
    """Request body for standalone verification sandbox testing"""
    task_type: TaskType
    task_description: str = Field(..., min_length=5, max_length=1000)
    worker_result: str = Field(..., min_length=1)
    worker_structured_data: Optional[dict] = Field(default_factory=dict)
    worker_agent_id: Optional[str] = "external-worker"
    demo_mode: Optional[Literal["success", "failure"]] = None


class ProofRecord(BaseModel):
    """The Proof of Agent Work record stored on-chain"""
    task_id: str
    agent_id: str
    task_type: str
    result_hash: str       # SHA-256 hash of agent's result
    verified: bool
    verification_hash: str # SHA-256 hash of verification data
    proof_hash: str        # Combined canonical proof hash
    timestamp: str
    blockchain_tx_hash: Optional[str] = None
    blockchain_recorded: bool = False


class ProofAuditRequest(BaseModel):
    """Request body for independent proof verification audit"""
    canonical_proof: dict
    expected_proof_hash: str


# ============================================================
# HEALTH MODEL
# ============================================================

class HealthResponse(BaseModel):
    status: str
    blockchain_connected: bool
    blockchain_network: Optional[str] = None
    agents_registered: int
    database_ok: bool


# ============================================================
# REPUTATION HISTORY MODELS
# ============================================================

class ReputationEvent(BaseModel):
    id: int
    task_id: str
    reputation_before: int
    reputation_after: int
    delta: int
    reason: str
    timestamp: str
    blockchain_tx_hash: Optional[str] = None


class ReputationHistoryResponse(BaseModel):
    agent_id: str
    agent_name: str
    current_reputation: int
    total_events: int
    history: List[ReputationEvent]


class ReputationSimulationRequest(BaseModel):
    starting_reputation: int = Field(80, ge=0, le=100)
    sequence: List[Literal["pass", "fail"]] = Field(..., min_length=1, max_length=50)


class ReputationSimulationStep(BaseModel):
    step: int
    action: Literal["pass", "fail"]
    reputation_before: int
    reputation_after: int
    delta: int
    status: str
    note: str


class ReputationSimulationResponse(BaseModel):
    starting_reputation: int
    final_reputation: int
    net_change: int
    untrusted_triggered: bool
    recovery_tasks_needed_from_single_fail: int
    steps: List[ReputationSimulationStep]

