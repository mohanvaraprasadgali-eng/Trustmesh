"""
TrustMesh — MST Blockchain Client (Full Implementation)
=========================================================
Handles all interaction with the MST Blockchain (EVM-compatible).
Uses web3.py to call deployed smart contracts.

MST Testnet Config:
  RPC URL:   https://testnetrpc.mstblockchain.com
  Chain ID:  91562037
  Explorer:  https://mstscan.com

Contracts (set via .env after deploy):
  AGENT_REGISTRY_ADDRESS
  REPUTATION_REGISTRY_ADDRESS
  TASK_ESCROW_ADDRESS
  BACKEND_WALLET_PRIVATE_KEY
"""

import os
import json
from pathlib import Path
from typing import Optional
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware


# ── MST Testnet configuration ────────────────────────────────────────────────
MST_RPC_URL  = os.getenv("MST_RPC_URL",  "https://testnetrpc.mstblockchain.com")
MST_CHAIN_ID = int(os.getenv("MST_CHAIN_ID", "91562037"))

# ABI directory — populated by scripts/deploy.js
_ABI_DIR = Path(__file__).parent / "abis"


def _load_abi(contract_name: str) -> list:
    """Load contract ABI from the abis/ directory."""
    abi_path = _ABI_DIR / f"{contract_name}.json"
    if not abi_path.exists():
        print(f"[WARN] ABI not found: {abi_path}  (run `npm run deploy:testnet` first)")
        return []
    with open(abi_path, "r") as f:
        return json.load(f)


class MSTClient:
    """
    Full client for interacting with TrustMesh contracts on MST Blockchain.

    Handles:
    - Connection management
    - AgentRegistry: register and look up agents
    - ReputationRegistry: update and read reputation scores
    - TaskEscrow: fund tasks, record proofs, verify results
    """

    def __init__(self):
        self.rpc_url  = MST_RPC_URL
        self.chain_id = MST_CHAIN_ID
        self.w3       = None
        self._connected = False
        self._connect()

        # Canonical deployment record: deployments/mst_testnet.json
        self.deployment_file = Path(__file__).resolve().parent.parent.parent / "deployments" / "mst_testnet.json"
        self.deployment_info = self._load_deployment_info()

        # Contract addresses from environment or canonical deployments/mst_testnet.json
        contracts_deployed = self.deployment_info.get("contracts", {}) if self.deployment_info else {}
        self.agent_registry_address      = os.getenv("AGENT_REGISTRY_ADDRESS", "").strip() or contracts_deployed.get("AgentRegistry", "")
        self.reputation_registry_address = os.getenv("REPUTATION_REGISTRY_ADDRESS", "").strip() or contracts_deployed.get("ReputationRegistry", "")
        self.task_escrow_address         = os.getenv("TASK_ESCROW_ADDRESS", "").strip() or contracts_deployed.get("TaskEscrow", "")

        # Backend wallet for signing transactions
        self.private_key = os.getenv("BACKEND_WALLET_PRIVATE_KEY", "")

        # Load ABIs
        self._agent_registry_abi      = _load_abi("AgentRegistry")
        self._reputation_registry_abi = _load_abi("ReputationRegistry")
        self._task_escrow_abi         = _load_abi("TaskEscrow")

        # Lazy-load contract instances
        self._agent_registry_contract      = None
        self._reputation_registry_contract = None
        self._task_escrow_contract         = None

    def _load_deployment_info(self) -> Optional[dict]:
        """Load canonical deployment record from deployments/mst_testnet.json."""
        if not self.deployment_file.exists():
            return None
        try:
            with open(self.deployment_file, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Error reading {self.deployment_file}: {e}")
            return None

    def get_deployment_info(self) -> dict:
        """Return deployment info and verification status."""
        info = self._load_deployment_info()
        if not info:
            return {
                "deployed": False,
                "message": "Contracts not deployed on MST Testnet",
                "network": "mst_testnet",
                "chain_id": self.chain_id,
                "contracts": {
                    "AgentRegistry": self.agent_registry_address or None,
                    "ReputationRegistry": self.reputation_registry_address or None,
                    "TaskEscrow": self.task_escrow_address or None
                },
                "transactions": {}
            }
        
        info["deployed"] = bool(
            self.agent_registry_address and
            self.reputation_registry_address and
            self.task_escrow_address
        )
        return info

    def has_contracts(self) -> bool:
        """Check if all 3 contracts are configured."""
        return bool(
            self.agent_registry_address and
            self.reputation_registry_address and
            self.task_escrow_address
        )

    def verify_bytecode(self, address: str) -> bool:
        """Check if contract address contains non-empty bytecode on MST Testnet."""
        if not self.is_connected() or not address or not address.startswith("0x"):
            return False
        try:
            checksum = Web3.to_checksum_address(address)
            code = self.w3.eth.get_code(checksum)
            return code is not None and len(code) > 2
        except Exception:
            return False

    # ── Connection ────────────────────────────────────────────────────────────

    def _connect(self):
        """Establish connection to MST Testnet."""
        try:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url, request_kwargs={"timeout": 3}))
            # MST is PoA — inject middleware for extraData compatibility
            self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            self._connected = self.w3.is_connected()
            if self._connected:
                try:
                    live_chain_id = self.w3.eth.chain_id
                    if live_chain_id:
                        self.chain_id = live_chain_id
                except Exception:
                    pass
                print(f"[OK] Connected to MST Blockchain at {self.rpc_url}")
                print(f"   Chain ID: {self.chain_id}")
            else:
                print(f"[WARN] Could not connect to MST Blockchain at {self.rpc_url}")
        except Exception as e:
            print(f"[WARN] MST Blockchain connection error: {e}")
            self._connected = False

    def is_connected(self, check_live: bool = False) -> bool:
        if self.w3 is None:
            return False
        if not check_live:
            return self._connected
        try:
            self._connected = bool(self.w3.is_connected())
            return self._connected
        except Exception:
            self._connected = False
            return False

    def get_block_number(self) -> Optional[int]:
        if not self.is_connected():
            return None
        try:
            return self.w3.eth.block_number
        except Exception:
            return None

    # ── Contract Loading ──────────────────────────────────────────────────────

    def _get_contract(self, address: str, abi: list):
        """Load a contract instance (with validation)."""
        if not self.is_connected():
            return None
        if not address or not address.startswith("0x") or len(address) != 42:
            return None
        if not abi:
            return None
        try:
            checksum = Web3.to_checksum_address(address)
            return self.w3.eth.contract(address=checksum, abi=abi)
        except Exception as e:
            print(f"[WARN] Could not load contract at {address}: {e}")
            return None

    @property
    def agent_registry(self):
        if self._agent_registry_contract is None:
            self._agent_registry_contract = self._get_contract(
                self.agent_registry_address, self._agent_registry_abi
            )
        return self._agent_registry_contract

    @property
    def reputation_registry(self):
        if self._reputation_registry_contract is None:
            self._reputation_registry_contract = self._get_contract(
                self.reputation_registry_address, self._reputation_registry_abi
            )
        return self._reputation_registry_contract

    @property
    def task_escrow(self):
        if self._task_escrow_contract is None:
            self._task_escrow_contract = self._get_contract(
                self.task_escrow_address, self._task_escrow_abi
            )
        return self._task_escrow_contract

    # ── Transaction Helper ────────────────────────────────────────────────────

    def _sign_and_send(self, transaction, value_wei: int = 0) -> Optional[str]:
        """
        Build, sign, and send a transaction.
        Returns transaction hash (0x-prefixed) or None on failure.
        """
        if not self.private_key or self.private_key.startswith("your_") or len(self.private_key.strip()) < 64:
            # Clean fallback when backend wallet has not been funded/provided yet
            return None

        try:
            account = self.w3.eth.account.from_key(self.private_key)
            nonce   = self.w3.eth.get_transaction_count(account.address)

            tx_params = {
                "from":     account.address,
                "nonce":    nonce,
                "gas":      400_000,
                "gasPrice": self.w3.eth.gas_price,
                "chainId":  self.chain_id,
            }
            if value_wei > 0:
                tx_params["value"] = value_wei

            tx     = transaction.build_transaction(tx_params)
            signed = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            if receipt.status == 1:
                tx_hex = f"0x{tx_hash.hex()}"
                print(f"[OK] Transaction confirmed: {tx_hex}")
                return tx_hex
            else:
                print("[FAIL] Transaction reverted")
                return None

        except Exception as e:
            print(f"[FAIL] Transaction failed: {e}")
            return None

    # ── AgentRegistry Interactions ────────────────────────────────────────────

    def register_agent_on_chain(
        self,
        agent_id: str,
        agent_type: str,
        wallet_address: str,
        metadata_uri: str = ""
    ) -> Optional[str]:
        """
        Register an agent on the MST Blockchain AgentRegistry.
        Returns transaction hash or None.
        """
        contract = self.agent_registry
        if contract is None:
            print("[WARN] AgentRegistry not available -- register agent off-chain only")
            return None

        try:
            checksum_wallet = Web3.to_checksum_address(wallet_address)
            fn = contract.functions.registerAgent(
                agent_id, agent_type, checksum_wallet, metadata_uri
            )
            return self._sign_and_send(fn)
        except Exception as e:
            print(f"[WARN] AgentRegistry.registerAgent failed: {e}")
            return None

    def is_agent_active_on_chain(self, agent_id: str) -> bool:
        """Check if an agent is active on-chain (read-only)."""
        contract = self.agent_registry
        if contract is None:
            return False
        try:
            return contract.functions.isAgentActive(agent_id).call()
        except Exception:
            return False

    def initialize_agent_reputation(self, agent_id: str) -> Optional[str]:
        """
        Initialize an agent in the ReputationRegistry (sets score to 80).
        Call this after registering a new agent.
        """
        contract = self.reputation_registry
        if contract is None:
            print("[WARN] ReputationRegistry not available")
            return None
        try:
            fn = contract.functions.initializeAgent(agent_id)
            return self._sign_and_send(fn)
        except Exception as e:
            print(f"[WARN] ReputationRegistry.initializeAgent failed: {e}")
            return None

    # ── ReputationRegistry Interactions ───────────────────────────────────────

    def update_reputation_on_chain(
        self,
        agent_wallet: str,  # kept for signature compat with orchestrator calls
        task_id: str,
        success: bool,
        agent_id: str = ""
    ) -> Optional[str]:
        """
        Record a task result in the on-chain ReputationRegistry.
        Returns transaction hash or None.

        Note: On-chain reputation uses agent_id (string), not wallet.
        If agent_id is empty, we skip the on-chain call gracefully.
        """
        if not agent_id:
            return None

        contract = self.reputation_registry
        if contract is None:
            return None

        try:
            fn = contract.functions.recordTaskResult(agent_id, task_id, success)
            return self._sign_and_send(fn)
        except Exception as e:
            print(f"[WARN] ReputationRegistry.recordTaskResult failed: {e}")
            return None

    def get_agent_reputation(self, agent_wallet: str) -> Optional[int]:
        """
        Read agent reputation from MST Blockchain.
        Note: on-chain lookup needs agent_id; this method is kept for
        backward compat but returns None if wallet-to-id lookup fails.
        """
        if not self.is_connected():
            return None
        if not self.reputation_registry:
            return None

        # Try wallet lookup via AgentRegistry
        try:
            if self.agent_registry:
                checksum = Web3.to_checksum_address(agent_wallet)
                agent_id = self.agent_registry.functions.getAgentIdByWallet(checksum).call()
                if agent_id:
                    return int(self.reputation_registry.functions.getScore(agent_id).call())
        except Exception:
            pass
        return None

    def get_reputation_by_agent_id(self, agent_id: str) -> Optional[int]:
        """Read reputation score directly by agent_id."""
        if not self.reputation_registry:
            return None
        try:
            return int(self.reputation_registry.functions.getScore(agent_id).call())
        except Exception:
            return None

    # ── TaskEscrow Interactions ───────────────────────────────────────────────

    def record_proof_on_chain(
        self,
        task_id: str,
        agent_id: str,
        proof_hash: str,
        verified: bool,
        agent_wallet: str = "",
        result_hash: str = "",
        verification_hash: str = ""
    ) -> Optional[str]:
        """
        Record a Proof of Agent Work on the MST Blockchain TaskEscrow.

        proof_hash, result_hash, verification_hash are 0x-prefixed hex strings
        (SHA-256 hashes from proof_generator.py). They are converted to bytes32.

        Returns transaction hash or None if not configured / not connected.
        """
        if not self.is_connected():
            print("[WARN] Blockchain not connected -- proof recorded off-chain only")
            return None

        contract = self.task_escrow
        if contract is None:
            print("[WARN] TaskEscrow contract not configured -- deploy contracts first")
            return None

        if not agent_wallet or not agent_wallet.startswith("0x"):
            print(f"[WARN] Invalid agent_wallet for on-chain proof: {agent_wallet}")
            return None

        try:
            def _to_bytes32(hex_str: str) -> bytes:
                """Convert 0x-prefixed 64-char hex string to 32-byte bytes."""
                stripped = hex_str.lstrip("0x")[:64].ljust(64, "0")
                return bytes.fromhex(stripped)

            proof_bytes  = _to_bytes32(proof_hash)  if proof_hash  else b"\x00" * 32
            result_bytes = _to_bytes32(result_hash) if result_hash else b"\x00" * 32
            verif_bytes  = _to_bytes32(verification_hash) if verification_hash else b"\x00" * 32

            checksum_wallet = Web3.to_checksum_address(agent_wallet)

            fn = contract.functions.recordProof(
                task_id,
                agent_id,
                checksum_wallet,
                proof_bytes,
                result_bytes,
                verif_bytes,
                verified
            )
            return self._sign_and_send(fn)

        except Exception as e:
            print(f"[WARN] TaskEscrow.recordProof failed: {e}")
            return None

    def verify_proof_on_chain(self, task_id: str, proof_hash: str) -> bool:
        """
        Verify a proof hash against the on-chain record.
        Returns True if the proof matches what's stored on-chain.
        """
        contract = self.task_escrow
        if contract is None:
            return False
        try:
            stripped = proof_hash.lstrip("0x")[:64].ljust(64, "0")
            proof_bytes = bytes.fromhex(stripped)
            return contract.functions.verifyProof(task_id, proof_bytes).call()
        except Exception:
            return False

    def get_on_chain_proof_hash(self, task_id: str) -> Optional[str]:
        """Read the proof hash stored on-chain for a task."""
        contract = self.task_escrow
        if contract is None:
            return None
        try:
            result = contract.functions.getProofHash(task_id).call()
            return "0x" + result.hex()
        except Exception:
            return None

    def get_task_on_chain(self, task_id: str) -> Optional[dict]:
        """Read complete task record from TaskEscrow on-chain."""
        contract = self.task_escrow
        if contract is None:
            return None
        try:
            raw = contract.functions.getTask(task_id).call()
            # raw: (taskId, client, amount, status, fundedAt, proofHash, resultHash, verificationHash, agentId, agentWallet, verified, completedAt)
            status_map = {0: "NONE", 1: "FUNDED", 2: "COMPLETED", 3: "REFUNDED", 4: "EXPIRED"}
            return {
                "task_id": raw[0],
                "client": raw[1],
                "amount_wei": str(raw[2]),
                "amount_mstc": float(Web3.from_wei(raw[2], 'ether')),
                "status": status_map.get(raw[3], str(raw[3])),
                "funded_at": raw[4],
                "proof_hash": "0x" + raw[5].hex() if raw[5] != b"\x00" * 32 else None,
                "result_hash": "0x" + raw[6].hex() if raw[6] != b"\x00" * 32 else None,
                "verification_hash": "0x" + raw[7].hex() if raw[7] != b"\x00" * 32 else None,
                "agent_id": raw[8],
                "agent_wallet": raw[9],
                "verified": raw[10],
                "completed_at": raw[11]
            }
        except Exception as e:
            return None

    def get_contract_stats(self) -> dict:
        """Read summary stats from TaskEscrow."""
        contract = self.task_escrow
        if contract is None:
            return {}
        try:
            return {
                "total_tasks":    int(contract.functions.totalTasks().call()),
                "total_funded":   int(contract.functions.totalFunded().call()),
                "total_released": int(contract.functions.totalReleased().call()),
                "total_refunded": int(contract.functions.totalRefunded().call()),
                "total_proofs":   int(contract.functions.totalProofs().call()),
                "balance":        int(contract.functions.contractBalance().call()),
            }
        except Exception as e:
            print(f"[WARN] get_contract_stats failed: {e}")
            return {}


_client_instance = None

def get_mst_client() -> MSTClient:
    """Return singleton MSTClient instance."""
    global _client_instance
    if _client_instance is None:
        _client_instance = MSTClient()
    return _client_instance
