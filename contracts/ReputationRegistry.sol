// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReputationRegistry
 * @notice TrustMesh — On-chain Agent Reputation Tracking
 * @dev Immutably records every reputation event for every agent.
 *
 * Design principles:
 * - Every score change is recorded as an on-chain event (full audit trail)
 * - Score changes are deterministic: +2 for success, -31 for failure
 * - Scores are capped 0–100
 * - Agent is flagged UNTRUSTED if score drops below UNTRUSTED_THRESHOLD
 * - History is stored in an append-only array per agent
 *
 * This is the trust foundation: a verifiable, tamper-proof history of
 * every agent's past behavior — readable by any party on the MST Blockchain.
 */
contract ReputationRegistry {

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant INITIAL_REPUTATION   = 80;
    uint256 public constant MAX_REPUTATION        = 100;
    uint256 public constant SUCCESS_BONUS         = 2;    // +2 per successful task
    uint256 public constant FAILURE_PENALTY       = 31;   // -31 per failed task
    uint256 public constant UNTRUSTED_THRESHOLD   = 40;   // flag agent below this score

    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Emitted on every reputation change
    event ReputationUpdated(
        string  indexed agentId,
        string  indexed taskId,
        uint256         scoreBefore,
        uint256         scoreAfter,
        bool            success,
        uint256         timestamp
    );

    /// @notice Emitted when agent drops below UNTRUSTED_THRESHOLD
    event AgentFlaggedUntrusted(
        string  indexed agentId,
        uint256         score,
        uint256         timestamp
    );

    // ─── Types ────────────────────────────────────────────────────────────────

    struct ReputationEvent {
        string  taskId;
        uint256 scoreBefore;
        uint256 scoreAfter;
        bool    success;
        uint256 timestamp;
    }

    struct AgentReputation {
        string   agentId;
        uint256  currentScore;
        uint256  totalTasksCompleted;
        uint256  totalTasksVerified;
        bool     isUntrusted;
        bool     initialized;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;

    /// agentId → current reputation state
    mapping(string => AgentReputation) private _reputations;

    /// agentId → chronological list of events
    mapping(string => ReputationEvent[]) private _history;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ReputationRegistry: not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Initialization ──────────────────────────────────────────────────────

    /**
     * @notice Initialize reputation for a newly registered agent.
     * @dev Called by backend after AgentRegistry.registerAgent().
     * @param agentId Agent to initialize
     */
    function initializeAgent(string calldata agentId) external onlyOwner {
        require(bytes(agentId).length > 0, "ReputationRegistry: empty agentId");
        require(!_reputations[agentId].initialized, "ReputationRegistry: already initialized");

        _reputations[agentId] = AgentReputation({
            agentId:              agentId,
            currentScore:         INITIAL_REPUTATION,
            totalTasksCompleted:  0,
            totalTasksVerified:   0,
            isUntrusted:          false,
            initialized:          true
        });
    }

    // ─── Score Updates ────────────────────────────────────────────────────────

    /**
     * @notice Record a task result and update agent reputation.
     * @dev Applies deterministic scoring rules, records event, emits event.
     * @param agentId  Agent that executed the task
     * @param taskId   Off-chain task identifier
     * @param success  Whether verification passed (true) or failed (false)
     */
    function recordTaskResult(
        string calldata agentId,
        string calldata taskId,
        bool            success
    ) external onlyOwner {
        require(_reputations[agentId].initialized, "ReputationRegistry: agent not initialized");
        require(bytes(taskId).length > 0, "ReputationRegistry: empty taskId");

        AgentReputation storage rep = _reputations[agentId];
        uint256 scoreBefore = rep.currentScore;
        uint256 scoreAfter;

        if (success) {
            // Cap at MAX_REPUTATION
            scoreAfter = scoreBefore + SUCCESS_BONUS;
            if (scoreAfter > MAX_REPUTATION) {
                scoreAfter = MAX_REPUTATION;
            }
            rep.totalTasksVerified++;
        } else {
            // Floor at 0
            if (scoreBefore >= FAILURE_PENALTY) {
                scoreAfter = scoreBefore - FAILURE_PENALTY;
            } else {
                scoreAfter = 0;
            }
        }

        rep.currentScore = scoreAfter;
        rep.totalTasksCompleted++;

        // Record in history
        _history[agentId].push(ReputationEvent({
            taskId:      taskId,
            scoreBefore: scoreBefore,
            scoreAfter:  scoreAfter,
            success:     success,
            timestamp:   block.timestamp
        }));

        emit ReputationUpdated(agentId, taskId, scoreBefore, scoreAfter, success, block.timestamp);

        // Flag agent as untrusted if below threshold
        if (scoreAfter < UNTRUSTED_THRESHOLD && !rep.isUntrusted) {
            rep.isUntrusted = true;
            emit AgentFlaggedUntrusted(agentId, scoreAfter, block.timestamp);
        }
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Get current reputation score for an agent.
     */
    function getScore(string calldata agentId) external view returns (uint256) {
        require(_reputations[agentId].initialized, "ReputationRegistry: agent not found");
        return _reputations[agentId].currentScore;
    }

    /**
     * @notice Get full reputation state for an agent.
     */
    function getReputation(string calldata agentId)
        external
        view
        returns (AgentReputation memory)
    {
        require(_reputations[agentId].initialized, "ReputationRegistry: agent not found");
        return _reputations[agentId];
    }

    /**
     * @notice Get full reputation history for an agent.
     * @dev Returns all events in chronological order.
     */
    function getHistory(string calldata agentId)
        external
        view
        returns (ReputationEvent[] memory)
    {
        return _history[agentId];
    }

    /**
     * @notice Get a specific history event by index.
     */
    function getHistoryAt(string calldata agentId, uint256 index)
        external
        view
        returns (ReputationEvent memory)
    {
        require(index < _history[agentId].length, "ReputationRegistry: index out of bounds");
        return _history[agentId][index];
    }

    /**
     * @notice Get total number of history events for an agent.
     */
    function historyLength(string calldata agentId) external view returns (uint256) {
        return _history[agentId].length;
    }

    /**
     * @notice Check if an agent is flagged as untrusted.
     */
    function isUntrusted(string calldata agentId) external view returns (bool) {
        if (!_reputations[agentId].initialized) return false;
        return _reputations[agentId].isUntrusted;
    }
}
