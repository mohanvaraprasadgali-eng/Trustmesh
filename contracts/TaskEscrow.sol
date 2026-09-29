// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TaskEscrow
 * @notice TrustMesh - Task Payment Escrow + Proof of Agent Work Registry
 * @dev The most critical contract in TrustMesh.
 *
 * Workflow for each task:
 *   1. Client calls fundTask() → ETH/tMSTC locked in escrow
 *   2. Agents execute task off-chain
 *   3. Verification Agent independently checks result
 *   4. Backend calls recordProof() with:
 *        - Cryptographic proof hash
 *        - Verification outcome (pass/fail)
 *   5. On success → releasePayment() sends funds to agent
 *      On failure → refundClient() returns funds to client
 *
 * Key innovation: the proof_hash is a SHA-256 hash of:
 *   { task_id, agent_id, task_type, result_hash, verified, verification_hash, timestamp }
 *
 * This creates a tamper-proof, verifiable record of exactly what was done,
 * who did it, and whether it was independently verified - stored on MST Blockchain.
 *
 * Anyone can verify any task result by:
 *   1. Fetching the proof from the chain
 *   2. Recomputing the hash from the known inputs
 *   3. Comparing - if they match, the record is authentic
 */
contract TaskEscrow {

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MAX_TASK_DURATION = 7 days;  // Escrow expiry

    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Emitted when a task is created and funded
    event TaskFunded(
        string  indexed taskId,
        address indexed client,
        uint256         amount,
        uint256         timestamp
    );

    /// @notice Emitted when a proof of agent work is recorded
    event ProofRecorded(
        string  indexed taskId,
        string  indexed agentId,
        bytes32         proofHash,
        bool            verified,
        uint256         timestamp
    );

    /// @notice Emitted when payment is released to agent
    event PaymentReleased(
        string  indexed taskId,
        string  indexed agentId,
        address indexed agentWallet,
        uint256         amount,
        uint256         timestamp
    );

    /// @notice Emitted when payment is refunded to client
    event PaymentRefunded(
        string  indexed taskId,
        address indexed client,
        uint256         amount,
        string          reason,
        uint256         timestamp
    );

    // ─── Types ────────────────────────────────────────────────────────────────

    enum TaskStatus {
        NONE,         // Does not exist
        FUNDED,       // Client deposited funds, waiting for execution
        COMPLETED,    // Proof recorded, payment processed
        EXPIRED       // Timed out, client can reclaim
    }

    struct Task {
        string     taskId;         // Unique off-chain task identifier
        address    client;         // Who funded the task
        uint256    amount;         // tMSTC locked in escrow
        TaskStatus status;
        uint256    fundedAt;       // Timestamp when funded
        // Proof data (set after verification)
        bytes32    proofHash;      // SHA-256 hash of the full proof bundle
        bytes32    resultHash;     // Hash of the agent's raw result
        bytes32    verificationHash; // Hash of the verification attestation
        string     agentId;        // Which agent executed the task
        address    agentWallet;    // Agent's wallet address (receives payment)
        bool       verified;       // Whether verification passed
        uint256    completedAt;    // Timestamp when proof was recorded
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;

    /// taskId → Task
    mapping(string => Task) private _tasks;

    /// All task IDs for enumeration
    string[] private _taskIds;

    // Total volume processed (for stats)
    uint256 public totalFunded;
    uint256 public totalReleased;
    uint256 public totalRefunded;
    uint256 public totalProofs;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "TaskEscrow: not owner");
        _;
    }

    modifier taskExists(string calldata taskId) {
        require(_tasks[taskId].status != TaskStatus.NONE, "TaskEscrow: task not found");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Task Lifecycle ──────────────────────────────────────────────────────

    /**
     * @notice Fund a task - locks tMSTC in escrow.
     * @dev Caller sends native token (tMSTC) with the transaction.
     *      Task ID must be unique (comes from backend UUID).
     * @param taskId Unique task identifier from backend
     */
    function fundTask(string calldata taskId) external payable {
        require(bytes(taskId).length > 0, "TaskEscrow: empty taskId");
        require(msg.value > 0, "TaskEscrow: must send tMSTC to fund task");
        require(_tasks[taskId].status == TaskStatus.NONE, "TaskEscrow: task already exists");

        _tasks[taskId] = Task({
            taskId:            taskId,
            client:            msg.sender,
            amount:            msg.value,
            status:            TaskStatus.FUNDED,
            fundedAt:          block.timestamp,
            proofHash:         bytes32(0),
            resultHash:        bytes32(0),
            verificationHash:  bytes32(0),
            agentId:           "",
            agentWallet:       address(0),
            verified:          false,
            completedAt:       0
        });

        _taskIds.push(taskId);
        totalFunded += msg.value;

        emit TaskFunded(taskId, msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Record the cryptographic Proof of Agent Work on-chain.
     * @dev Called by TrustMesh backend after verification is complete.
     *      Automatically releases or refunds payment based on `verified`.
     *
     * @param taskId            Task identifier
     * @param agentId           Agent that performed the work
     * @param agentWallet       Agent's wallet (receives payment if verified)
     * @param proofHash         Combined SHA-256 proof hash (stored on-chain)
     * @param resultHash        Hash of agent's raw result
     * @param verificationHash  Hash of verification attestation
     * @param verified          True = verification passed, False = failed
     */
    function recordProof(
        string  calldata taskId,
        string  calldata agentId,
        address          agentWallet,
        bytes32          proofHash,
        bytes32          resultHash,
        bytes32          verificationHash,
        bool             verified
    ) external onlyOwner taskExists(taskId) {
        Task storage task = _tasks[taskId];
        require(task.status == TaskStatus.FUNDED, "TaskEscrow: task not in FUNDED state");
        require(proofHash != bytes32(0), "TaskEscrow: invalid proof hash");
        require(agentWallet != address(0), "TaskEscrow: invalid agent wallet");

        // Store proof data
        task.agentId           = agentId;
        task.agentWallet       = agentWallet;
        task.proofHash         = proofHash;
        task.resultHash        = resultHash;
        task.verificationHash  = verificationHash;
        task.verified          = verified;
        task.completedAt       = block.timestamp;
        task.status            = TaskStatus.COMPLETED;

        totalProofs++;

        emit ProofRecorded(taskId, agentId, proofHash, verified, block.timestamp);

        // Automatically process payment based on verification outcome
        if (verified) {
            _releasePayment(taskId);
        } else {
            _refundClient(taskId, "Verification failed - agent result rejected");
        }
    }

    // ─── Payment Processing ──────────────────────────────────────────────────

    /**
     * @dev Internal: release payment to agent wallet.
     */
    function _releasePayment(string calldata taskId) internal {
        Task storage task = _tasks[taskId];
        uint256 amount = task.amount;
        address recipient = task.agentWallet;

        // Reset amount before transfer (reentrancy guard)
        task.amount = 0;
        totalReleased += amount;

        (bool sent, ) = payable(recipient).call{value: amount}("");
        require(sent, "TaskEscrow: payment transfer failed");

        emit PaymentReleased(taskId, task.agentId, recipient, amount, block.timestamp);
    }

    /**
     * @dev Internal: refund locked funds to client.
     */
    function _refundClient(string calldata taskId, string memory reason) internal {
        Task storage task = _tasks[taskId];
        uint256 amount = task.amount;
        address client = task.client;

        task.amount = 0;
        totalRefunded += amount;

        (bool sent, ) = payable(client).call{value: amount}("");
        require(sent, "TaskEscrow: refund transfer failed");

        emit PaymentRefunded(taskId, client, amount, reason, block.timestamp);
    }

    /**
     * @notice Allow client to reclaim funds if task expired (no proof within MAX_TASK_DURATION).
     * @param taskId Task to expire and refund
     */
    function reclaimExpired(string calldata taskId) external taskExists(taskId) {
        Task storage task = _tasks[taskId];
        require(task.status == TaskStatus.FUNDED, "TaskEscrow: task not in FUNDED state");
        require(msg.sender == task.client, "TaskEscrow: only client can reclaim");
        require(
            block.timestamp > task.fundedAt + MAX_TASK_DURATION,
            "TaskEscrow: task not yet expired"
        );

        task.status = TaskStatus.EXPIRED;
        uint256 amount = task.amount;
        task.amount = 0;
        totalRefunded += amount;

        (bool sent, ) = payable(task.client).call{value: amount}("");
        require(sent, "TaskEscrow: reclaim transfer failed");

        emit PaymentRefunded(taskId, task.client, amount, "Task expired - client reclaimed", block.timestamp);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Get full task record.
     */
    function getTask(string calldata taskId)
        external
        view
        taskExists(taskId)
        returns (Task memory)
    {
        return _tasks[taskId];
    }

    /**
     * @notice Get just the proof hash for a completed task.
     * @dev Useful for quick verification without fetching the whole struct.
     */
    function getProofHash(string calldata taskId)
        external
        view
        taskExists(taskId)
        returns (bytes32)
    {
        return _tasks[taskId].proofHash;
    }

    /**
     * @notice Check if a proof hash is valid for a given task.
     * @dev Allows anyone to independently verify a task result on-chain.
     */
    function verifyProof(string calldata taskId, bytes32 proofHash)
        external
        view
        returns (bool)
    {
        if (_tasks[taskId].status == TaskStatus.NONE) return false;
        return _tasks[taskId].proofHash == proofHash;
    }

    /**
     * @notice Get total number of tasks.
     */
    function totalTasks() external view returns (uint256) {
        return _taskIds.length;
    }

    /**
     * @notice Get task ID at index.
     */
    function taskIdAt(uint256 index) external view returns (string memory) {
        require(index < _taskIds.length, "TaskEscrow: index out of range");
        return _taskIds[index];
    }

    /**
     * @notice Get contract balance (total locked tMSTC).
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Emergency withdraw - owner only, for stuck funds.
     * @dev Should only be used if a bug causes funds to be permanently locked.
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "TaskEscrow: no balance");
        (bool sent, ) = payable(owner).call{value: balance}("");
        require(sent, "TaskEscrow: withdrawal failed");
    }

    /// @dev Accept plain tMSTC transfers (e.g. direct top-ups)
    receive() external payable {}
}
