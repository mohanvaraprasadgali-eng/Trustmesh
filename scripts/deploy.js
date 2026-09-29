/**
 * TrustMesh — Hardhat Deployment Script
 * ========================================
 * Deploys all three TrustMesh contracts in order:
 *   1. AgentRegistry      — agent identity
 *   2. ReputationRegistry — agent reputation
 *   3. TaskEscrow         — escrow + proof recording
 *
 * After deployment:
 *   - Writes contract addresses and tx hashes to console
 *   - Automatically saves deployments/<network>.json and deployments/mst_testnet.json
 *   - Automatically updates backend/.env and frontend/.env.local with real deployed addresses
 *   - Copies ABIs to backend/blockchain/abis/ and frontend/src/contracts/abis/
 *
 * Usage:
 *   Local:   npm run deploy:local
 *   Testnet: npm run deploy:testnet
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function updateEnvFile(filePath, updates) {
    if (!fs.existsSync(filePath)) {
        console.warn(`[WARN] File not found: ${filePath} (skipping auto-update)`);
        return;
    }
    let content = fs.readFileSync(filePath, "utf8");
    for (const [key, val] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${val}`);
        } else {
            content += `\n${key}=${val}`;
        }
    }
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[OK] Updated ${path.basename(path.dirname(filePath))}/${path.basename(filePath)} with deployed addresses.`);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    if (!deployer) {
        throw new Error("No deployer signer available. Please check PRIVATE_KEY in your .env file.");
    }
    const networkName = network.name;
    const providerNetwork = await ethers.provider.getNetwork();
    const chainId = Number(network.config.chainId || providerNetwork.chainId);

    console.log("\n============================================================");
    console.log("  TrustMesh Contract Deployment");
    console.log("============================================================");
    console.log(`  Network:  ${networkName}`);
    console.log(`  Chain ID: ${chainId}`);
    console.log(`  Deployer: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`  Balance:  ${ethers.formatEther(balance)} tMSTC`);
    console.log("============================================================\n");

    // ─── 1. Deploy AgentRegistry ─────────────────────────────────────────────
    console.log("[1/3] Deploying AgentRegistry...");
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();
    const agentRegistryDeployTx = agentRegistry.deploymentTransaction();
    const agentRegistryTxHash = agentRegistryDeployTx ? agentRegistryDeployTx.hash : null;
    await agentRegistry.waitForDeployment();
    const agentRegistryAddress = await agentRegistry.getAddress();
    console.log(`      [OK] AgentRegistry deployed: ${agentRegistryAddress}`);
    console.log(`      [TX] Tx Hash: ${agentRegistryTxHash}`);

    // ─── 2. Deploy ReputationRegistry ────────────────────────────────────────
    console.log("[2/3] Deploying ReputationRegistry...");
    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    const reputationRegistry = await ReputationRegistry.deploy();
    const reputationRegistryDeployTx = reputationRegistry.deploymentTransaction();
    const reputationRegistryTxHash = reputationRegistryDeployTx ? reputationRegistryDeployTx.hash : null;
    await reputationRegistry.waitForDeployment();
    const reputationRegistryAddress = await reputationRegistry.getAddress();
    console.log(`      [OK] ReputationRegistry deployed: ${reputationRegistryAddress}`);
    console.log(`      [TX] Tx Hash: ${reputationRegistryTxHash}`);

    // ─── 3. Deploy TaskEscrow ─────────────────────────────────────────────────
    console.log("[3/3] Deploying TaskEscrow...");
    const TaskEscrow = await ethers.getContractFactory("TaskEscrow");
    const taskEscrow = await TaskEscrow.deploy();
    const taskEscrowDeployTx = taskEscrow.deploymentTransaction();
    const taskEscrowTxHash = taskEscrowDeployTx ? taskEscrowDeployTx.hash : null;
    await taskEscrow.waitForDeployment();
    const taskEscrowAddress = await taskEscrow.getAddress();
    console.log(`      [OK] TaskEscrow deployed:         ${taskEscrowAddress}`);
    console.log(`      [TX] Tx Hash: ${taskEscrowTxHash}`);

    // ─── Summary ──────────────────────────────────────────────────────────────
    const deployment = {
        network: networkName,
        chainId: chainId,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        contracts: {
            AgentRegistry: agentRegistryAddress,
            ReputationRegistry: reputationRegistryAddress,
            TaskEscrow: taskEscrowAddress,
        },
        transactions: {
            AgentRegistry: agentRegistryTxHash,
            ReputationRegistry: reputationRegistryTxHash,
            TaskEscrow: taskEscrowTxHash,
        },
        details: {
            AgentRegistry: {
                address: agentRegistryAddress,
                txHash: agentRegistryTxHash,
            },
            ReputationRegistry: {
                address: reputationRegistryAddress,
                txHash: reputationRegistryTxHash,
            },
            TaskEscrow: {
                address: taskEscrowAddress,
                txHash: taskEscrowTxHash,
            },
        },
    };

    console.log("\n============================================================");
    console.log("  Deployment Complete!");
    console.log("============================================================");
    console.log(`  AgentRegistry:      ${agentRegistryAddress} (tx: ${agentRegistryTxHash})`);
    console.log(`  ReputationRegistry: ${reputationRegistryAddress} (tx: ${reputationRegistryTxHash})`);
    console.log(`  TaskEscrow:         ${taskEscrowAddress} (tx: ${taskEscrowTxHash})`);
    console.log("============================================================");

    // ─── Save deployment JSON ────────────────────────────────────────────────
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const outPath = path.join(deploymentsDir, `${networkName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
    console.log(`[OK] Deployment record saved: deployments/${networkName}.json`);

    if (networkName === "mst_testnet" || chainId === 91562037) {
        const mstTestnetPath = path.join(deploymentsDir, "mst_testnet.json");
        fs.writeFileSync(mstTestnetPath, JSON.stringify(deployment, null, 2));
        console.log(`[OK] Deployment record saved: deployments/mst_testnet.json`);
    }

    // ─── Update backend/.env and frontend/.env.local ──────────────────────────
    const backendEnvPath = path.join(__dirname, "..", "backend", ".env");
    updateEnvFile(backendEnvPath, {
        AGENT_REGISTRY_ADDRESS: agentRegistryAddress,
        REPUTATION_REGISTRY_ADDRESS: reputationRegistryAddress,
        TASK_ESCROW_ADDRESS: taskEscrowAddress,
    });

    const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env.local");
    updateEnvFile(frontendEnvPath, {
        NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS: agentRegistryAddress,
        NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS: reputationRegistryAddress,
        NEXT_PUBLIC_TASK_ESCROW_ADDRESS: taskEscrowAddress,
    });

    // Print explorer links if on testnet
    if (networkName === "mst_testnet" || chainId === 91562037) {
        console.log("\n[INFO] View on MST Explorer:");
        console.log(`  AgentRegistry:      https://mstscan.com/address/${agentRegistryAddress}`);
        console.log(`  ReputationRegistry: https://mstscan.com/address/${reputationRegistryAddress}`);
        console.log(`  TaskEscrow:         https://mstscan.com/address/${taskEscrowAddress}\n`);
    }

    // ─── Also copy ABIs to backend for Python web3 client ────────────────────
    await copyAbisToBackend();

    return deployment;
}

/**
 * Copy compiled ABIs from artifacts/ to backend/blockchain/abis/
 * so the Python web3 client can load them directly.
 */
async function copyAbisToBackend() {
    const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
    const backendAbisDir = path.join(__dirname, "..", "backend", "blockchain", "abis");
    const frontendAbisDir = path.join(__dirname, "..", "frontend", "src", "contracts", "abis");

    for (const dir of [backendAbisDir, frontendAbisDir]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    const contracts = ["AgentRegistry", "ReputationRegistry", "TaskEscrow"];

    for (const contractName of contracts) {
        const artifactPath = path.join(
            artifactsDir,
            `${contractName}.sol`,
            `${contractName}.json`
        );

        if (!fs.existsSync(artifactPath)) {
            console.warn(`[WARN] ABI not found for ${contractName} at ${artifactPath}`);
            continue;
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        const backendAbiPath = path.join(backendAbisDir, `${contractName}.json`);
        const frontendAbiPath = path.join(frontendAbisDir, `${contractName}.json`);

        // Write just the ABI (not the full artifact) for compact size
        const abiJson = JSON.stringify(artifact.abi, null, 2);
        fs.writeFileSync(backendAbiPath, abiJson);
        fs.writeFileSync(frontendAbiPath, abiJson);
        console.log(`[OK] ABI copied to backend and frontend: ${contractName}.json`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("[ERROR]", error);
        process.exit(1);
    });
