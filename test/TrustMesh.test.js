/**
 * TrustMesh — Hardhat Contract Tests
 * =====================================
 * Full test suite for all three TrustMesh contracts.
 * Covers the happy path, failure modes, edge cases, and access control.
 *
 * Run: npx hardhat test --no-compile
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toWei   = (n) => ethers.parseEther(String(n));
const toHex32 = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

// ─── AgentRegistry Tests ──────────────────────────────────────────────────────

describe("AgentRegistry", function () {
    let agentRegistry;
    let owner, agent1, agent2, other;

    beforeEach(async function () {
        [owner, agent1, agent2, other] = await ethers.getSigners();
        const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
        agentRegistry = await AgentRegistry.deploy();
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await agentRegistry.owner()).to.equal(owner.address);
        });

        it("Should start with zero agents", async function () {
            expect(await agentRegistry.totalAgents()).to.equal(0n);
        });
    });

    describe("registerAgent()", function () {
        it("Should emit AgentRegistered event on registration", async function () {
            const tx = agentRegistry.registerAgent(
                "agent-pricing-001", "pricing", agent1.address, "ipfs://metadata"
            );
            await expect(tx).to.emit(agentRegistry, "AgentRegistered");
            expect(await agentRegistry.totalAgents()).to.equal(1n);
        });

        it("Should store agent data correctly", async function () {
            await agentRegistry.registerAgent("agent-research-001", "research", agent1.address, "");
            const agent = await agentRegistry.getAgent("agent-research-001");
            expect(agent.agentId).to.equal("agent-research-001");
            expect(agent.agentType).to.equal("research");
            expect(agent.walletAddress).to.equal(agent1.address);
            expect(agent.status).to.equal("ACTIVE");
        });

        it("Should fail on duplicate agentId", async function () {
            await agentRegistry.registerAgent("agent-001", "pricing", agent1.address, "");
            await expect(
                agentRegistry.registerAgent("agent-001", "research", agent2.address, "")
            ).to.be.revertedWith("AgentRegistry: agentId already registered");
        });

        it("Should fail on duplicate wallet address", async function () {
            await agentRegistry.registerAgent("agent-001", "pricing", agent1.address, "");
            await expect(
                agentRegistry.registerAgent("agent-002", "research", agent1.address, "")
            ).to.be.revertedWith("AgentRegistry: wallet already registered");
        });

        it("Should fail with zero address", async function () {
            await expect(
                agentRegistry.registerAgent("agent-001", "pricing", ethers.ZeroAddress, "")
            ).to.be.revertedWith("AgentRegistry: zero address");
        });

        it("Should fail with empty agentId", async function () {
            await expect(
                agentRegistry.registerAgent("", "pricing", agent1.address, "")
            ).to.be.revertedWith("AgentRegistry: empty agentId");
        });

        it("Should enumerate agents via agentIdAt()", async function () {
            await agentRegistry.registerAgent("agent-001", "pricing", agent1.address, "");
            await agentRegistry.registerAgent("agent-002", "research", agent2.address, "");
            expect(await agentRegistry.totalAgents()).to.equal(2n);
            expect(await agentRegistry.agentIdAt(0)).to.equal("agent-001");
            expect(await agentRegistry.agentIdAt(1)).to.equal("agent-002");
        });
    });

    describe("isAgentActive()", function () {
        it("Should return true for an active registered agent", async function () {
            await agentRegistry.registerAgent("agent-001", "pricing", agent1.address, "");
            expect(await agentRegistry.isAgentActive("agent-001")).to.be.true;
        });

        it("Should return false for unregistered agent", async function () {
            expect(await agentRegistry.isAgentActive("nobody")).to.be.false;
        });
    });

    describe("setAgentStatus()", function () {
        beforeEach(async function () {
            await agentRegistry.registerAgent("agent-001", "pricing", agent1.address, "");
        });

        it("Should emit AgentStatusChanged when owner changes status", async function () {
            await expect(
                agentRegistry.setAgentStatus("agent-001", "UNTRUSTED")
            ).to.emit(agentRegistry, "AgentStatusChanged");
            expect(await agentRegistry.isAgentActive("agent-001")).to.be.false;
        });

        it("Should revert if not owner", async function () {
            await expect(
                agentRegistry.connect(other).setAgentStatus("agent-001", "INACTIVE")
            ).to.be.revertedWith("AgentRegistry: not owner");
        });

        it("Should revert for non-existent agent", async function () {
            await expect(
                agentRegistry.setAgentStatus("nobody", "INACTIVE")
            ).to.be.revertedWith("AgentRegistry: agent not found");
        });
    });

    describe("getAgentIdByWallet()", function () {
        it("Should return correct agentId for wallet", async function () {
            await agentRegistry.registerAgent("agent-001", "pricing", agent1.address, "");
            expect(await agentRegistry.getAgentIdByWallet(agent1.address)).to.equal("agent-001");
        });

        it("Should return empty string for unknown wallet", async function () {
            expect(await agentRegistry.getAgentIdByWallet(other.address)).to.equal("");
        });
    });
});


// ─── ReputationRegistry Tests ─────────────────────────────────────────────────

describe("ReputationRegistry", function () {
    let repReg;
    let owner, other;

    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
        repReg = await ReputationRegistry.deploy();
    });

    describe("Constants", function () {
        it("Should have correct scoring constants", async function () {
            expect(await repReg.INITIAL_REPUTATION()).to.equal(80n);
            expect(await repReg.MAX_REPUTATION()).to.equal(100n);
            expect(await repReg.SUCCESS_BONUS()).to.equal(2n);
            expect(await repReg.FAILURE_PENALTY()).to.equal(31n);
            expect(await repReg.UNTRUSTED_THRESHOLD()).to.equal(40n);
        });
    });

    describe("initializeAgent()", function () {
        it("Should initialize with INITIAL_REPUTATION = 80", async function () {
            await repReg.initializeAgent("agent-001");
            expect(await repReg.getScore("agent-001")).to.equal(80n);
        });

        it("Should fail on double initialization", async function () {
            await repReg.initializeAgent("agent-001");
            await expect(repReg.initializeAgent("agent-001")).to.be.revertedWith(
                "ReputationRegistry: already initialized"
            );
        });

        it("Should revert if not owner", async function () {
            await expect(
                repReg.connect(other).initializeAgent("agent-001")
            ).to.be.revertedWith("ReputationRegistry: not owner");
        });
    });

    describe("recordTaskResult() — success path", function () {
        beforeEach(async function () {
            await repReg.initializeAgent("agent-001");
        });

        it("Should emit ReputationUpdated and increase score by +2", async function () {
            await expect(repReg.recordTaskResult("agent-001", "task-abc", true))
                .to.emit(repReg, "ReputationUpdated");
            expect(await repReg.getScore("agent-001")).to.equal(82n);
        });

        it("Should cap score at MAX_REPUTATION = 100", async function () {
            for (let i = 0; i < 15; i++) {
                await repReg.recordTaskResult("agent-001", `task-${i}`, true);
            }
            expect(await repReg.getScore("agent-001")).to.equal(100n);
        });

        it("Should increment totalTasksCompleted and totalTasksVerified", async function () {
            await repReg.recordTaskResult("agent-001", "task-abc", true);
            const rep = await repReg.getReputation("agent-001");
            expect(rep.totalTasksCompleted).to.equal(1n);
            expect(rep.totalTasksVerified).to.equal(1n);
        });
    });

    describe("recordTaskResult() — failure path", function () {
        beforeEach(async function () {
            await repReg.initializeAgent("agent-001");
        });

        it("Should emit ReputationUpdated and decrease score by -31", async function () {
            await expect(repReg.recordTaskResult("agent-001", "task-bad", false))
                .to.emit(repReg, "ReputationUpdated");
            expect(await repReg.getScore("agent-001")).to.equal(49n);
        });

        it("Should floor score at 0, not go negative", async function () {
            await repReg.recordTaskResult("agent-001", "t1", false); // 80→49
            await repReg.recordTaskResult("agent-001", "t2", false); // 49→18
            await repReg.recordTaskResult("agent-001", "t3", false); // 18→0
            expect(await repReg.getScore("agent-001")).to.equal(0n);
        });

        it("Should emit AgentFlaggedUntrusted when score drops below 40", async function () {
            await repReg.recordTaskResult("agent-001", "t1", false); // 80→49 (not yet)
            await expect(repReg.recordTaskResult("agent-001", "t2", false)) // 49→18 (UNTRUSTED)
                .to.emit(repReg, "AgentFlaggedUntrusted");
            expect(await repReg.isUntrusted("agent-001")).to.be.true;
        });

        it("Should not emit AgentFlaggedUntrusted twice for same agent", async function () {
            await repReg.recordTaskResult("agent-001", "t1", false);
            await repReg.recordTaskResult("agent-001", "t2", false); // triggers UNTRUSTED
            const tx = await repReg.recordTaskResult("agent-001", "t3", false);
            const receipt = await tx.wait();
            const flagEvents = receipt.logs.filter(
                (log) => log.fragment?.name === "AgentFlaggedUntrusted"
            );
            expect(flagEvents.length).to.equal(0);
        });

        it("Should increment totalTasksCompleted but NOT totalTasksVerified", async function () {
            await repReg.recordTaskResult("agent-001", "task-bad", false);
            const rep = await repReg.getReputation("agent-001");
            expect(rep.totalTasksCompleted).to.equal(1n);
            expect(rep.totalTasksVerified).to.equal(0n);
        });
    });

    describe("getHistory()", function () {
        it("Should record events in chronological order with correct values", async function () {
            await repReg.initializeAgent("agent-001");
            await repReg.recordTaskResult("agent-001", "t1", true);  // 80→82
            await repReg.recordTaskResult("agent-001", "t2", false); // 82→51

            expect(await repReg.historyLength("agent-001")).to.equal(2n);

            const e1 = await repReg.getHistoryAt("agent-001", 0);
            expect(e1.taskId).to.equal("t1");
            expect(e1.success).to.be.true;
            expect(e1.scoreBefore).to.equal(80n);
            expect(e1.scoreAfter).to.equal(82n);

            const e2 = await repReg.getHistoryAt("agent-001", 1);
            expect(e2.taskId).to.equal("t2");
            expect(e2.success).to.be.false;
            expect(e2.scoreBefore).to.equal(82n);
            expect(e2.scoreAfter).to.equal(51n);
        });

        it("Should revert on out-of-bounds index", async function () {
            await repReg.initializeAgent("agent-001");
            await expect(repReg.getHistoryAt("agent-001", 0))
                .to.be.revertedWith("ReputationRegistry: index out of bounds");
        });
    });

    describe("Access control — recordTaskResult", function () {
        it("Should revert if not owner", async function () {
            await repReg.initializeAgent("agent-001");
            await expect(
                repReg.connect(other).recordTaskResult("agent-001", "task-x", true)
            ).to.be.revertedWith("ReputationRegistry: not owner");
        });

        it("Should revert for uninitialized agent", async function () {
            await expect(
                repReg.recordTaskResult("ghost-agent", "task-x", true)
            ).to.be.revertedWith("ReputationRegistry: agent not initialized");
        });
    });
});


// ─── TaskEscrow Tests ─────────────────────────────────────────────────────────

describe("TaskEscrow", function () {
    let taskEscrow;
    let owner, client, agentWallet, other;

    const TASK_ID      = "task-abc123";
    const AGENT_ID     = "agent-pricing-001";
    const PROOF_HASH   = toHex32("proof-of-work");
    const RESULT_HASH  = toHex32("agent-result");
    const VERIF_HASH   = toHex32("verification");
    const FUND_AMOUNT  = toWei(1);

    beforeEach(async function () {
        [owner, client, agentWallet, other] = await ethers.getSigners();
        const TaskEscrow = await ethers.getContractFactory("TaskEscrow");
        taskEscrow = await TaskEscrow.deploy();
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await taskEscrow.owner()).to.equal(owner.address);
        });

        it("Should start with zero tasks", async function () {
            expect(await taskEscrow.totalTasks()).to.equal(0n);
        });
    });

    describe("fundTask()", function () {
        it("Should emit TaskFunded and lock funds", async function () {
            await expect(
                taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT })
            ).to.emit(taskEscrow, "TaskFunded");

            expect(await taskEscrow.totalTasks()).to.equal(1n);
            expect(await taskEscrow.contractBalance()).to.equal(FUND_AMOUNT);
        });

        it("Should store task data correctly", async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
            const task = await taskEscrow.getTask(TASK_ID);
            expect(task.taskId).to.equal(TASK_ID);
            expect(task.client).to.equal(client.address);
            expect(task.amount).to.equal(FUND_AMOUNT);
            expect(task.status).to.equal(1n); // FUNDED
        });

        it("Should fail with zero value", async function () {
            await expect(
                taskEscrow.connect(client).fundTask(TASK_ID, { value: 0n })
            ).to.be.revertedWith("TaskEscrow: must send tMSTC to fund task");
        });

        it("Should fail if task already exists", async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
            await expect(
                taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT })
            ).to.be.revertedWith("TaskEscrow: task already exists");
        });

        it("Should fail with empty taskId", async function () {
            await expect(
                taskEscrow.connect(client).fundTask("", { value: FUND_AMOUNT })
            ).to.be.revertedWith("TaskEscrow: empty taskId");
        });
    });

    describe("recordProof() — VERIFIED (payment released)", function () {
        beforeEach(async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
        });

        it("Should emit ProofRecorded and PaymentReleased, send funds to agent", async function () {
            const agentBefore = await ethers.provider.getBalance(agentWallet.address);

            await expect(
                taskEscrow.recordProof(
                    TASK_ID, AGENT_ID, agentWallet.address,
                    PROOF_HASH, RESULT_HASH, VERIF_HASH, true
                )
            ).to.emit(taskEscrow, "ProofRecorded")
             .and.to.emit(taskEscrow, "PaymentReleased");

            const agentAfter = await ethers.provider.getBalance(agentWallet.address);
            expect(agentAfter - agentBefore).to.equal(FUND_AMOUNT);
            expect(await taskEscrow.contractBalance()).to.equal(0n);
        });

        it("Should store proof data on the task", async function () {
            await taskEscrow.recordProof(
                TASK_ID, AGENT_ID, agentWallet.address,
                PROOF_HASH, RESULT_HASH, VERIF_HASH, true
            );
            const task = await taskEscrow.getTask(TASK_ID);
            expect(task.proofHash).to.equal(PROOF_HASH);
            expect(task.resultHash).to.equal(RESULT_HASH);
            expect(task.verified).to.be.true;
            expect(task.agentId).to.equal(AGENT_ID);
            expect(task.status).to.equal(2n); // COMPLETED
        });
    });

    describe("recordProof() — NOT VERIFIED (refund to client)", function () {
        beforeEach(async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
        });

        it("Should emit ProofRecorded and PaymentRefunded, return funds to client", async function () {
            await expect(
                taskEscrow.recordProof(
                    TASK_ID, AGENT_ID, agentWallet.address,
                    PROOF_HASH, RESULT_HASH, VERIF_HASH, false
                )
            ).to.emit(taskEscrow, "ProofRecorded")
             .and.to.emit(taskEscrow, "PaymentRefunded");

            expect(await taskEscrow.contractBalance()).to.equal(0n);
        });

        it("Should set verified = false on task", async function () {
            await taskEscrow.recordProof(
                TASK_ID, AGENT_ID, agentWallet.address,
                PROOF_HASH, RESULT_HASH, VERIF_HASH, false
            );
            const task = await taskEscrow.getTask(TASK_ID);
            expect(task.verified).to.be.false;
            expect(task.status).to.equal(2n); // COMPLETED
        });
    });

    describe("recordProof() — Access control & validation", function () {
        beforeEach(async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
        });

        it("Should revert if not owner", async function () {
            await expect(
                taskEscrow.connect(other).recordProof(
                    TASK_ID, AGENT_ID, agentWallet.address,
                    PROOF_HASH, RESULT_HASH, VERIF_HASH, true
                )
            ).to.be.revertedWith("TaskEscrow: not owner");
        });

        it("Should fail with zero bytes32 proof hash", async function () {
            await expect(
                taskEscrow.recordProof(
                    TASK_ID, AGENT_ID, agentWallet.address,
                    ethers.ZeroHash, RESULT_HASH, VERIF_HASH, true
                )
            ).to.be.revertedWith("TaskEscrow: invalid proof hash");
        });

        it("Should fail with zero agent wallet", async function () {
            await expect(
                taskEscrow.recordProof(
                    TASK_ID, AGENT_ID, ethers.ZeroAddress,
                    PROOF_HASH, RESULT_HASH, VERIF_HASH, true
                )
            ).to.be.revertedWith("TaskEscrow: invalid agent wallet");
        });

        it("Should fail if task is not in FUNDED state (re-execute)", async function () {
            await taskEscrow.recordProof(
                TASK_ID, AGENT_ID, agentWallet.address,
                PROOF_HASH, RESULT_HASH, VERIF_HASH, true
            );
            await expect(
                taskEscrow.recordProof(
                    TASK_ID, AGENT_ID, agentWallet.address,
                    PROOF_HASH, RESULT_HASH, VERIF_HASH, true
                )
            ).to.be.revertedWith("TaskEscrow: task not in FUNDED state");
        });
    });

    describe("verifyProof()", function () {
        it("Should return true for correct proof hash", async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
            await taskEscrow.recordProof(
                TASK_ID, AGENT_ID, agentWallet.address,
                PROOF_HASH, RESULT_HASH, VERIF_HASH, true
            );
            expect(await taskEscrow.verifyProof(TASK_ID, PROOF_HASH)).to.be.true;
        });

        it("Should return false for wrong proof hash (tamper check)", async function () {
            await taskEscrow.connect(client).fundTask(TASK_ID, { value: FUND_AMOUNT });
            await taskEscrow.recordProof(
                TASK_ID, AGENT_ID, agentWallet.address,
                PROOF_HASH, RESULT_HASH, VERIF_HASH, true
            );
            expect(await taskEscrow.verifyProof(TASK_ID, toHex32("tampered"))).to.be.false;
        });

        it("Should return false for unknown task", async function () {
            expect(await taskEscrow.verifyProof("unknown-task", PROOF_HASH)).to.be.false;
        });
    });

    describe("Statistics tracking", function () {
        it("Should track totalFunded, totalReleased, totalRefunded, totalProofs", async function () {
            const TASK_A = "task-aaa";
            const TASK_B = "task-bbb";

            await taskEscrow.connect(client).fundTask(TASK_A, { value: toWei(1) });
            await taskEscrow.connect(client).fundTask(TASK_B, { value: toWei(2) });
            expect(await taskEscrow.totalFunded()).to.equal(toWei(3));

            await taskEscrow.recordProof(TASK_A, AGENT_ID, agentWallet.address, PROOF_HASH, RESULT_HASH, VERIF_HASH, true);
            expect(await taskEscrow.totalReleased()).to.equal(toWei(1));

            await taskEscrow.recordProof(TASK_B, AGENT_ID, agentWallet.address, toHex32("ph2"), RESULT_HASH, VERIF_HASH, false);
            expect(await taskEscrow.totalRefunded()).to.equal(toWei(2));

            expect(await taskEscrow.totalProofs()).to.equal(2n);
        });
    });

    describe("Multiple tasks", function () {
        it("Should handle multiple concurrent funded tasks independently", async function () {
            await taskEscrow.connect(client).fundTask("task-1", { value: toWei(1) });
            await taskEscrow.connect(client).fundTask("task-2", { value: toWei(2) });
            await taskEscrow.connect(client).fundTask("task-3", { value: toWei(3) });

            expect(await taskEscrow.totalTasks()).to.equal(3n);
            expect(await taskEscrow.contractBalance()).to.equal(toWei(6));
            expect(await taskEscrow.taskIdAt(2)).to.equal("task-3");
        });
    });
});
