import { ethers } from "ethers";
import AgentRegistryABI from "./abis/AgentRegistry.json";
import ReputationRegistryABI from "./abis/ReputationRegistry.json";
import TaskEscrowABI from "./abis/TaskEscrow.json";

/**
 * Format raw Web3/Ethers exceptions into clean, user-friendly messages.
 */
export function formatContractError(err: any): string {
  if (!err) return "An unknown Web3 error occurred.";
  
  // User rejection in MetaMask / BridgeKey
  if (
    err.code === "ACTION_REJECTED" || 
    err.code === 4001 || 
    err.message?.includes("user rejected") ||
    err.message?.includes("User denied")
  ) {
    return "Transaction was cancelled / rejected by the user in the wallet.";
  }

  // Insufficient balance
  if (
    err.code === "INSUFFICIENT_FUNDS" ||
    err.message?.includes("insufficient funds")
  ) {
    return "Insufficient tMSTC in wallet to cover the transaction value and network gas.";
  }

  // Contract specific reverts
  const msg = err.reason || err.shortMessage || err.message || "";

  if (msg.includes("Task already exists")) {
    return "This task ID is already registered in the TaskEscrow contract.";
  }
  if (msg.includes("Task not funded")) {
    return "The requested task is not in funded status.";
  }
  if (msg.includes("Agent already registered")) {
    return "An agent with this ID or wallet is already registered on-chain.";
  }
  if (msg.includes("Agent not active")) {
    return "The assigned agent is currently inactive in the registry.";
  }
  if (msg.includes("Caller is not owner")) {
    return "Only the contract owner is authorized to perform this administrative action.";
  }
  if (msg.includes("Zero address")) {
    return "Invalid zero address provided for wallet.";
  }
  if (msg.includes("network changed") || err.code === "NETWORK_ERROR") {
    return "Network connection interrupted or switched. Please ensure you are on MST Testnet (Chain ID: 91562037).";
  }

  return msg || "Transaction execution failed on MST Blockchain.";
}

export function getAgentRegistryContract(
  address: string,
  signerOrProvider: ethers.ContractRunner
) {
  return new ethers.Contract(address, AgentRegistryABI, signerOrProvider);
}

export function getReputationRegistryContract(
  address: string,
  signerOrProvider: ethers.ContractRunner
) {
  return new ethers.Contract(address, ReputationRegistryABI, signerOrProvider);
}

export function getTaskEscrowContract(
  address: string,
  signerOrProvider: ethers.ContractRunner
) {
  return new ethers.Contract(address, TaskEscrowABI, signerOrProvider);
}

/**
 * Register an agent on-chain through user's wallet
 */
export async function registerAgentOnChain(
  signer: ethers.JsonRpcSigner,
  contractAddress: string,
  agentId: string,
  agentType: string,
  walletAddress: string,
  metadataUri: string = ""
): Promise<{ txHash: string; receipt: ethers.TransactionReceipt }> {
  try {
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      throw new Error("AgentRegistry contract is not deployed on MST Testnet yet. Deploy contracts before registering agents on-chain.");
    }
    const contract = getAgentRegistryContract(contractAddress, signer);
    const checksumWallet = ethers.getAddress(walletAddress);

    const tx = await contract.registerAgent(
      agentId,
      agentType,
      checksumWallet,
      metadataUri
    );

    const receipt = await tx.wait(1);
    return { txHash: tx.hash, receipt };
  } catch (err: any) {
    throw new Error(formatContractError(err));
  }
}

/**
 * Fund task escrow on-chain through user's wallet
 */
export async function fundTaskOnChain(
  signer: ethers.JsonRpcSigner,
  contractAddress: string,
  taskId: string,
  budgetEther: string
): Promise<{ txHash: string; receipt: ethers.TransactionReceipt }> {
  try {
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      throw new Error("TaskEscrow contract is not deployed on MST Testnet yet.");
    }
    const contract = getTaskEscrowContract(contractAddress, signer);
    const valueWei = ethers.parseEther(budgetEther);

    const tx = await contract.fundTask(taskId, {
      value: valueWei,
    });

    const receipt = await tx.wait(1);
    return { txHash: tx.hash, receipt };
  } catch (err: any) {
    throw new Error(formatContractError(err));
  }
}

/**
 * Read task record directly on-chain from TaskEscrow.sol
 */
export async function getTaskOnChain(
  provider: ethers.ContractRunner,
  contractAddress: string,
  taskId: string
): Promise<any | null> {
  try {
    const contract = getTaskEscrowContract(contractAddress, provider);
    const raw = await contract.getTask(taskId);
    const statusMap = ["NONE", "FUNDED", "COMPLETED", "EXPIRED"];

    return {
      taskId: raw.taskId,
      client: raw.client,
      amountWei: raw.amount.toString(),
      amountMSTC: ethers.formatEther(raw.amount),
      status: statusMap[Number(raw.status)] || String(raw.status),
      fundedAt: Number(raw.fundedAt),
      proofHash: raw.proofHash,
      resultHash: raw.resultHash,
      verificationHash: raw.verificationHash,
      agentId: raw.agentId,
      agentWallet: raw.agentWallet,
      verified: raw.verified,
      completedAt: Number(raw.completedAt),
    };
  } catch (err) {
    console.error("Failed to read task on-chain:", err);
    return null;
  }
}

/**
 * Verify proof hash on-chain directly via TaskEscrow.sol.verifyProof
 */
export async function verifyProofOnChain(
  provider: ethers.ContractRunner,
  contractAddress: string,
  taskId: string,
  proofHash: string
): Promise<boolean> {
  try {
    const contract = getTaskEscrowContract(contractAddress, provider);
    return await contract.verifyProof(taskId, proofHash);
  } catch (err) {
    console.error("Failed to verify proof on-chain:", err);
    return false;
  }
}

/**
 * Read agent record directly on-chain from AgentRegistry.sol
 */
export async function getAgentOnChain(
  provider: ethers.ContractRunner,
  contractAddress: string,
  agentId: string
): Promise<any | null> {
  try {
    const contract = getAgentRegistryContract(contractAddress, provider);
    const raw = await contract.getAgent(agentId);
    return {
      agentId: raw.agentId,
      agentType: raw.agentType,
      walletAddress: raw.walletAddress,
      registeredAt: Number(raw.registeredAt),
      status: raw.status,
      active: raw.status === "ACTIVE",
      exists: raw.exists,
      metadataUri: raw.metadataUri,
    };
  } catch (err) {
    console.error("Failed to read agent on-chain:", err);
    return null;
  }
}

/**
 * Read agent reputation directly on-chain from ReputationRegistry.sol
 */
export async function getReputationOnChain(
  provider: ethers.ContractRunner,
  contractAddress: string,
  agentId: string
): Promise<any | null> {
  try {
    const contract = getReputationRegistryContract(contractAddress, provider);
    const raw = await contract.getReputation(agentId);
    return {
      score: Number(raw.currentScore),
      currentScore: Number(raw.currentScore),
      totalTasksCompleted: Number(raw.totalTasksCompleted),
      totalTasksVerified: Number(raw.totalTasksVerified),
      isUntrusted: raw.isUntrusted,
      initialized: raw.initialized,
    };
  } catch (err) {
    console.error("Failed to read reputation on-chain:", err);
    return null;
  }
}
