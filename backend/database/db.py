"""
TrustMesh — SQLite Database Setup
Uses SQLAlchemy with aiosqlite for async SQLite access.

Design decision: SQLite stores OFF-CHAIN application data.
Blockchain stores ON-CHAIN trust-critical state.
"""

import os
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean,
    Text, DateTime, Enum as SAEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, UTC
import enum

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "trustmesh.db").replace("\\", "/")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# Create synchronous engine (simpler for MVP)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Required for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============================================================
# DATABASE MODELS (Off-chain application state)
# ============================================================

class AgentDB(Base):
    """
    Off-chain agent data.
    Trust-critical data (reputation, registration) also goes on-chain.
    """
    __tablename__ = "agents"

    agent_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    agent_type = Column(String, nullable=False)
    wallet_address = Column(String, nullable=False)
    reputation = Column(Integer, default=80)
    tasks_completed = Column(Integer, default=0)
    tasks_verified = Column(Integer, default=0)
    status = Column(String, default="ACTIVE")  # ACTIVE, INACTIVE, UNTRUSTED
    registered_at = Column(DateTime, default=lambda: datetime.now(UTC))
    metadata_uri = Column(String, default="")

    # Blockchain tracking
    blockchain_registered = Column(Boolean, default=False)
    blockchain_tx_hash = Column(String, nullable=True)


class TaskDB(Base):
    """
    Off-chain task record. Stores full task data.
    Only proof hash and status go on-chain.
    """
    __tablename__ = "tasks"

    task_id = Column(String, primary_key=True)
    task_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    budget = Column(Float, nullable=False)
    status = Column(String, default="CREATED")
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    completed_at = Column(DateTime, nullable=True)

    # Agent tracking
    assigned_agent_id = Column(String, nullable=True)
    agent_result = Column(Text, nullable=True)

    # Verification
    verified = Column(Boolean, nullable=True)
    verification_reason = Column(Text, nullable=True)
    verification_confidence = Column(Integer, nullable=True)
    verified_result = Column(Text, nullable=True)

    # Proof of Agent Work
    proof_hash = Column(String, nullable=True)
    result_hash = Column(String, nullable=True)

    # Blockchain
    blockchain_tx_hash = Column(String, nullable=True)
    blockchain_recorded = Column(Boolean, default=False)

    # Reputation
    reputation_before = Column(Integer, nullable=True)
    reputation_after = Column(Integer, nullable=True)

    # Payment
    payment_status = Column(String, nullable=True)  # RELEASED, BLOCKED

    # Demo mode
    demo_mode = Column(String, nullable=True)  # 'success', 'failure'


class ProofDB(Base):
    """
    Off-chain copy of Proof of Agent Work.
    The proof hash itself is stored on-chain.
    """
    __tablename__ = "proofs"

    proof_id = Column(String, primary_key=True)
    task_id = Column(String, nullable=False, index=True)
    agent_id = Column(String, nullable=False, index=True)
    task_type = Column(String, nullable=False)
    result_hash = Column(String, nullable=False)
    verified = Column(Boolean, nullable=False)
    verification_hash = Column(String, nullable=False)
    proof_hash = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    # Blockchain
    blockchain_tx_hash = Column(String, nullable=True)
    blockchain_recorded = Column(Boolean, default=False)


class ReputationHistoryDB(Base):
    """
    Chronological reputation history log for each agent.
    Mirrors on-chain ReputationRegistry event logs.
    """
    __tablename__ = "reputation_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String, nullable=False, index=True)
    task_id = Column(String, nullable=False)
    reputation_before = Column(Integer, nullable=False)
    reputation_after = Column(Integer, nullable=False)
    delta = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(UTC))
    blockchain_tx_hash = Column(String, nullable=True)


# ============================================================
# INITIALIZATION
# ============================================================

def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)
    print("[OK] TrustMesh database initialized")



def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
