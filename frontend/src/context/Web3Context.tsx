"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ethers } from "ethers";

export type EnvironmentMode = "LOCAL_DEMO" | "MST_TESTNET";

export interface ContractAddresses {
  agentRegistry: string;
  reputationRegistry: string;
  taskEscrow: string;
}

interface Web3ContextType {
  account: string | null;
  balance: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  environment: EnvironmentMode;
  setEnvironment: (mode: EnvironmentMode) => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToMSTTestnet: () => Promise<void>;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  signer: ethers.JsonRpcSigner | null;
  contractAddresses: ContractAddresses;
  areContractsDeployed: boolean;
  deploymentInfo: any | null;
  refreshContracts: () => Promise<void>;
  networkName: string;
  error: string | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

// MST Testnet Configuration
const MST_TESTNET_CONFIG = {
  chainIdHex: "0x5752035", // 91562037
  chainIdDec: 91562037,
  chainIdAlt: 4545,
  chainName: "MST Blockchain Testnet",
  rpcUrl: "https://testnetrpc.mstblockchain.com",
  blockExplorerUrl: "https://mstscan.com",
  nativeCurrency: {
    name: "Masterstroke Coin",
    symbol: "tMSTC",
    decimals: 18,
  },
};

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [environment, setEnvironmentState] = useState<EnvironmentMode>("LOCAL_DEMO");
  const [provider, setProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Contract Addresses from env or dynamic backend sync
  const [contractAddresses, setContractAddresses] = useState<ContractAddresses>({
    agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || "",
    reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "",
    taskEscrow: process.env.NEXT_PUBLIC_TASK_ESCROW_ADDRESS || "",
  });
  const [deploymentInfo, setDeploymentInfo] = useState<any | null>(null);

  const areContractsDeployed = Boolean(
    contractAddresses.agentRegistry &&
    contractAddresses.reputationRegistry &&
    contractAddresses.taskEscrow
  );

  const refreshContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/blockchain/stats");
      if (res.ok) {
        const data = await res.json();
        if (data.contracts) {
          setContractAddresses({
            agentRegistry: data.contracts.agent_registry || process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || "",
            reputationRegistry: data.contracts.reputation_registry || process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "",
            taskEscrow: data.contracts.task_escrow || process.env.NEXT_PUBLIC_TASK_ESCROW_ADDRESS || "",
          });
        }
        if (data.deployment) {
          setDeploymentInfo(data.deployment);
        }
      }
    } catch {
      // Backend may be starting or offline
    }
  }, []);

  useEffect(() => {
    refreshContracts();
  }, [refreshContracts]);

  const isCorrectNetwork =
    environment === "LOCAL_DEMO"
      ? true
      : chainId === MST_TESTNET_CONFIG.chainIdDec || chainId === MST_TESTNET_CONFIG.chainIdAlt;

  const networkName =
    environment === "LOCAL_DEMO"
      ? "Local Demo Mode"
      : isCorrectNetwork
      ? "MST Testnet (Live)"
      : `Wrong Network (Chain ${chainId || "Unknown"})`;

  // Read balance
  const refreshBalance = useCallback(async (walletAddress: string, activeProvider: ethers.BrowserProvider | ethers.JsonRpcProvider) => {
    try {
      const bal = await activeProvider.getBalance(walletAddress);
      setBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
    } catch {
      setBalance(null);
    }
  }, []);

  // Set environment with persistence
  const setEnvironment = (mode: EnvironmentMode) => {
    setEnvironmentState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("trustmesh_env", mode);
    }
  };

  // Restore saved env on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trustmesh_env") as EnvironmentMode;
      if (saved === "LOCAL_DEMO" || saved === "MST_TESTNET") {
        setEnvironmentState(saved);
      }
    }
  }, []);

  // Setup default provider
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      setProvider(browserProvider);

      browserProvider.getNetwork().then((net) => {
        setChainId(Number(net.chainId));
      }).catch(() => {});

      // Listen for account and chain changes
      const handleAccounts = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          refreshBalance(accounts[0], browserProvider);
        } else {
          setAccount(null);
          setSigner(null);
          setBalance(null);
        }
      };

      const handleChain = (hexChain: string) => {
        setChainId(parseInt(hexChain, 16));
      };

      (window as any).ethereum.on("accountsChanged", handleAccounts);
      (window as any).ethereum.on("chainChanged", handleChain);

      return () => {
        if ((window as any).ethereum.removeListener) {
          (window as any).ethereum.removeListener("accountsChanged", handleAccounts);
          (window as any).ethereum.removeListener("chainChanged", handleChain);
        }
      };
    } else {
      // Fallback read-only JSON-RPC provider to MST Testnet
      const rpc = new ethers.JsonRpcProvider(MST_TESTNET_CONFIG.rpcUrl);
      setProvider(rpc);
    }
  }, [refreshBalance]);

  // Connect wallet
  const connectWallet = async () => {
    setError(null);
    setIsConnecting(true);

    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No Web3 wallet (MetaMask / BridgeKey) detected. Please install an EVM wallet to connect.");
      }

      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts authorized by user.");
      }

      const userAccount = accounts[0];
      const userSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      setAccount(userAccount);
      setSigner(userSigner);
      setProvider(browserProvider);
      setChainId(Number(network.chainId));

      await refreshBalance(userAccount, browserProvider);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setError(err?.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setBalance(null);
  };

  // Switch to MST Testnet network via EIP-3085 / EIP-3326
  const switchToMSTTestnet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MST_TESTNET_CONFIG.chainIdHex }],
      });
    } catch (switchError: any) {
      // 4902 error code means the chain has not been added yet
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: MST_TESTNET_CONFIG.chainIdHex,
                chainName: MST_TESTNET_CONFIG.chainName,
                rpcUrls: [MST_TESTNET_CONFIG.rpcUrl],
                blockExplorerUrls: [MST_TESTNET_CONFIG.blockExplorerUrl],
                nativeCurrency: MST_TESTNET_CONFIG.nativeCurrency,
              },
            ],
          });
        } catch (addError: any) {
          setError(addError?.message || "Failed to add MST Testnet to wallet.");
        }
      } else {
        setError(switchError?.message || "Failed to switch to MST Testnet.");
      }
    }
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        balance,
        chainId,
        isCorrectNetwork,
        isConnecting,
        environment,
        setEnvironment,
        connectWallet,
        disconnectWallet,
        switchToMSTTestnet,
        provider,
        signer,
        contractAddresses,
        areContractsDeployed,
        deploymentInfo,
        refreshContracts,
        networkName,
        error,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
};
