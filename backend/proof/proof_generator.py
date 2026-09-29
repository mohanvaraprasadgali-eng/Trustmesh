"""
TrustMesh — Proof of Agent Work Generator
==========================================
Generates a cryptographic proof for every agent task result.

Design:
- Worker agent produces a result
- Verification agent independently checks it
- We create a canonical JSON from both
- We hash it with SHA-256
- The hash is stored on-chain (not the full data)

This is the "Proof of Agent Work" concept:
A verifiable, tamper-proof record of what an agent did
and whether it was independently validated.
"""

import hashlib
import json
import uuid
from datetime import datetime, UTC
from typing import Optional


def _canonical_json(data: dict) -> str:
    """
    Convert a dictionary to canonical JSON string.
    
    Canonical means:
    - Keys sorted alphabetically
    - No extra whitespace
    - Consistent encoding
    
    This ensures the same data always produces the same hash,
    regardless of insertion order.
    """
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def hash_data(data: dict) -> str:
    """
    Hash a dictionary using SHA-256.
    Returns hex string prefixed with 0x (like Ethereum hashes).
    """
    canonical = _canonical_json(data)
    sha256_hash = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    return f"0x{sha256_hash}"


def generate_result_hash(
    task_id: str,
    agent_id: str,
    task_type: str,
    result: str
) -> str:
    """
    Generate a hash of the agent's result.
    This proves what result the agent returned.
    """
    data = {
        "task_id": task_id,
        "agent_id": agent_id,
        "task_type": task_type,
        "result": result
    }
    return hash_data(data)


def generate_verification_hash(
    task_id: str,
    agent_id: str,
    verified: bool,
    verified_result: str,
    confidence: int
) -> str:
    """
    Generate a hash of the verification outcome.
    This proves what the verifier concluded.
    """
    data = {
        "task_id": task_id,
        "agent_id": agent_id,
        "confidence": confidence,
        "verified": verified,
        "verified_result": verified_result
    }
    return hash_data(data)


def generate_proof_of_work(
    task_id: str,
    agent_id: str,
    task_type: str,
    result: str,
    verified: bool,
    verified_result: str,
    confidence: int,
    timestamp: Optional[str] = None
) -> dict:
    """
    Generate the complete Proof of Agent Work.
    
    This is the canonical proof that captures:
    - What task was performed
    - Which agent did it
    - What result was returned
    - Whether verification passed
    - The combined proof hash (to store on-chain)
    
    Returns a dictionary with all proof data.
    The 'proof_hash' field is what gets stored on MST Blockchain.
    """
    if timestamp is None:
        timestamp = datetime.now(UTC).isoformat()

    # Hash of just the agent's result
    result_hash = generate_result_hash(task_id, agent_id, task_type, result)

    # Hash of the verification outcome
    verification_hash = generate_verification_hash(
        task_id, agent_id, verified, verified_result, confidence
    )

    # Combined canonical proof structure
    # This is the complete picture of the trust event
    canonical_proof = {
        "agent_id": agent_id,
        "result_hash": result_hash,
        "task_id": task_id,
        "task_type": task_type,
        "timestamp": timestamp,
        "verification_hash": verification_hash,
        "verified": verified
    }

    # Final proof hash — this goes on-chain
    proof_hash = hash_data(canonical_proof)

    return {
        "task_id": task_id,
        "agent_id": agent_id,
        "task_type": task_type,
        "result_hash": result_hash,
        "verified": verified,
        "verification_hash": verification_hash,
        "proof_hash": proof_hash,
        "timestamp": timestamp,
        "canonical_proof": canonical_proof  # For display/debugging
    }


def verify_canonical_proof(canonical_proof: dict, expected_proof_hash: str) -> dict:
    """
    Verify that a canonical proof structure matches an expected proof hash.
    Recalculates SHA-256 over the canonical JSON serialization.
    """
    computed = hash_data(canonical_proof)
    valid = computed.lower() == expected_proof_hash.lower()
    return {
        "valid": valid,
        "computed_proof_hash": computed,
        "expected_proof_hash": expected_proof_hash,
        "match": valid
    }


def audit_full_proof(
    task_id: str,
    agent_id: str,
    task_type: str,
    result: str,
    verified: bool,
    verified_result: str,
    confidence: int,
    timestamp: str,
    claimed_result_hash: str,
    claimed_verification_hash: str,
    claimed_proof_hash: str
) -> dict:
    """
    Full 3-tier integrity audit of the Proof of Agent Work:
      Tier 1: result_hash integrity check
      Tier 2: verification_hash integrity check
      Tier 3: combined canonical proof_hash integrity check
    """
    computed_result_hash = generate_result_hash(task_id, agent_id, task_type, result)
    computed_verification_hash = generate_verification_hash(
        task_id, agent_id, verified, verified_result, confidence
    )
    canonical = {
        "agent_id": agent_id,
        "result_hash": computed_result_hash,
        "task_id": task_id,
        "task_type": task_type,
        "timestamp": timestamp,
        "verification_hash": computed_verification_hash,
        "verified": verified
    }
    computed_proof_hash = hash_data(canonical)

    result_valid = computed_result_hash.lower() == claimed_result_hash.lower()
    verification_valid = computed_verification_hash.lower() == claimed_verification_hash.lower()
    proof_valid = computed_proof_hash.lower() == claimed_proof_hash.lower()

    overall_valid = result_valid and verification_valid and proof_valid

    return {
        "overall_valid": overall_valid,
        "tier1_result_hash": {
            "valid": result_valid,
            "computed": computed_result_hash,
            "claimed": claimed_result_hash
        },
        "tier2_verification_hash": {
            "valid": verification_valid,
            "computed": computed_verification_hash,
            "claimed": claimed_verification_hash
        },
        "tier3_proof_hash": {
            "valid": proof_valid,
            "computed": computed_proof_hash,
            "claimed": claimed_proof_hash
        },
        "canonical_proof": canonical
    }
