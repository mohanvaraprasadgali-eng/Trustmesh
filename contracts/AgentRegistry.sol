// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice TrustMesh — On-chain AI Agent Identity Registry
 * @dev Stores verifiable identity for autonomous AI agents on MST Blockchain.
 *
 * Every agent that wants to operate in the TrustMesh network must register here.
 * Registration creates an immutable, on-chain identity linked to a wallet address.
 *
 * This contract is part of the TrustMesh trust layer:
 *   AgentRegistry → who the agent is
 *   ReputationRegistry → how trustworthy the agent is
 *   TaskEscrow → payment gated by verification
 */
contract AgentRegistry {

    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Emitted when a new agent is registered
    event AgentRegistered(
        string  indexed agentId,
        address indexed walletAddress,
        string          agentType,
        uint256         timestamp
    );

    /// @notice Emitted when agent status changes (ACTIVE ↔ INACTIVE ↔ UNTRUSTED)
    event AgentStatusChanged(
        string  indexed agentId,
        string          newStatus,
        uint256         timestamp
    );

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Agent {
        string  agentId;         // Unique off-chain identifier (e.g. "agent-pricing-001")
        string  agentType;       // "research" | "pricing" | "analysis" | "verification"
        address walletAddress;   // Agent's EOA wallet
        string  metadataUri;     // IPFS URI for extended metadata
        string  status;          // "ACTIVE" | "INACTIVE" | "UNTRUSTED"
        uint256 registeredAt;    // block.timestamp at registration
        bool    exists;          // guard against default struct
    }

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;

    /// agentId → Agent
    mapping(string => Agent) private _agents;

    /// wallet → agentId (for reverse lookup)
    mapping(address => string) private _walletToAgentId;

    /// All registered agent IDs (for enumeration)
    string[] private _agentIds;

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentRegistry: not owner");
        _;
    }

    modifier agentExists(string calldata agentId) {
        require(_agents[agentId].exists, "AgentRegistry: agent not found");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Registration ────────────────────────────────────────────────────────

    /**
     * @notice Register a new AI agent on-chain.
     * @dev Each agentId and walletAddress must be unique.
     * @param agentId       Unique agent identifier string
     * @param agentType     Type of agent ("research", "pricing", etc.)
     * @param walletAddress Agent's wallet address
     * @param metadataUri   Optional IPFS URI for extended agent metadata
     */
    function registerAgent(
        string  calldata agentId,
        string  calldata agentType,
        address          walletAddress,
        string  calldata metadataUri
    ) external {
        require(bytes(agentId).length > 0, "AgentRegistry: empty agentId");
        require(bytes(agentType).length > 0, "AgentRegistry: empty agentType");
        require(walletAddress != address(0), "AgentRegistry: zero address");
        require(!_agents[agentId].exists, "AgentRegistry: agentId already registered");
        require(
            bytes(_walletToAgentId[walletAddress]).length == 0,
            "AgentRegistry: wallet already registered"
        );

        _agents[agentId] = Agent({
            agentId:       agentId,
            agentType:     agentType,
            walletAddress: walletAddress,
            metadataUri:   metadataUri,
            status:        "ACTIVE",
            registeredAt:  block.timestamp,
            exists:        true
        });

        _walletToAgentId[walletAddress] = agentId;
        _agentIds.push(agentId);

        emit AgentRegistered(agentId, walletAddress, agentType, block.timestamp);
    }

    // ─── Status Management ────────────────────────────────────────────────────

    /**
     * @notice Update an agent's status (owner only).
     * @dev Called by ReputationRegistry when rep drops below threshold.
     * @param agentId   Agent to update
     * @param newStatus "ACTIVE" | "INACTIVE" | "UNTRUSTED"
     */
    function setAgentStatus(
        string calldata agentId,
        string calldata newStatus
    ) external onlyOwner agentExists(agentId) {
        _agents[agentId].status = newStatus;
        emit AgentStatusChanged(agentId, newStatus, block.timestamp);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Get full agent record.
     */
    function getAgent(string calldata agentId)
        external
        view
        agentExists(agentId)
        returns (Agent memory)
    {
        return _agents[agentId];
    }

    /**
     * @notice Check if an agent is registered and active.
     */
    function isAgentActive(string calldata agentId) external view returns (bool) {
        if (!_agents[agentId].exists) return false;
        return keccak256(bytes(_agents[agentId].status)) == keccak256(bytes("ACTIVE"));
    }

    /**
     * @notice Look up agentId from wallet address.
     */
    function getAgentIdByWallet(address wallet) external view returns (string memory) {
        return _walletToAgentId[wallet];
    }

    /**
     * @notice Get total registered agent count.
     */
    function totalAgents() external view returns (uint256) {
        return _agentIds.length;
    }

    /**
     * @notice Get agent ID by index (for enumeration).
     */
    function agentIdAt(uint256 index) external view returns (string memory) {
        require(index < _agentIds.length, "AgentRegistry: index out of range");
        return _agentIds[index];
    }
}
