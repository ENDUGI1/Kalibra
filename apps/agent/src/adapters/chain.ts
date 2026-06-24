import {
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { OnChainStatus, predictionRegistryAbi } from "../abi/predictionRegistry.js";
import type { Config } from "../config.js";
import { log } from "../lib/logger.js";

export type ChainTxKind = "commit" | "reveal" | "record";

export interface ChainTx {
  txHash: Hex;
  mode: "mock" | "amoy";
}

/** Deterministic fake tx hash so mock runs are reproducible and traceable. */
function mockTxHash(kind: ChainTxKind, marketId: Hex, payload: Hex): Hex {
  return keccak256(encodePacked(["string", "bytes32", "bytes32"], [kind, marketId, payload]));
}

interface AmoyClients {
  wallet: WalletClient;
  publicClient: PublicClient;
  account: ReturnType<typeof privateKeyToAccount>;
  contract: Hex;
}

function amoyClients(cfg: Config): AmoyClients {
  if (!cfg.privateKey) throw new Error("CHAIN_MODE=amoy requires PRIVATE_KEY");
  if (!cfg.contractAddress) throw new Error("CHAIN_MODE=amoy requires CONTRACT_ADDRESS");
  const account = privateKeyToAccount(cfg.privateKey as Hex);
  const transport = http(cfg.rpcUrl);
  return {
    account,
    wallet: createWalletClient({ account, chain: polygonAmoy, transport }),
    publicClient: createPublicClient({ chain: polygonAmoy, transport }),
    contract: cfg.contractAddress as Hex,
  };
}

async function sendAndWait(
  cfg: Config,
  kind: ChainTxKind,
  functionName: "commitPrediction" | "revealPrediction" | "recordOutcome",
  args: readonly unknown[],
): Promise<ChainTx> {
  const { wallet, publicClient, account, contract } = amoyClients(cfg);
  const txHash = await wallet.writeContract({
    account,
    chain: polygonAmoy,
    address: contract,
    abi: predictionRegistryAbi,
    functionName,
    // viem infers per-function arg tuples; our call sites pass the right shapes.
    args: args as never,
  });
  log.info(kind, `tx submitted to Amoy, awaiting confirmation`, { txHash });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`${kind} tx reverted: ${txHash}`);
  return { txHash, mode: "amoy" };
}

export async function commitPrediction(
  cfg: Config,
  marketId: Hex,
  predictionHash: Hex,
): Promise<ChainTx> {
  if (cfg.chainMode === "amoy") {
    return sendAndWait(cfg, "commit", "commitPrediction", [marketId, predictionHash]);
  }
  const txHash = mockTxHash("commit", marketId, predictionHash);
  log.info("commit", "simulated commit (CHAIN_MODE=mock)", { txHash });
  return { txHash, mode: "mock" };
}

export async function revealPrediction(
  cfg: Config,
  marketId: Hex,
  probBps: number,
  salt: Hex,
): Promise<ChainTx> {
  if (cfg.chainMode === "amoy") {
    return sendAndWait(cfg, "reveal", "revealPrediction", [marketId, BigInt(probBps), salt]);
  }
  const txHash = mockTxHash("reveal", marketId, salt);
  log.info("reveal", "simulated reveal (CHAIN_MODE=mock)", { txHash });
  return { txHash, mode: "mock" };
}

export async function recordOutcome(
  cfg: Config,
  marketId: Hex,
  outcome: boolean,
  brierBps: number,
): Promise<ChainTx> {
  if (cfg.chainMode === "amoy") {
    return sendAndWait(cfg, "record", "recordOutcome", [marketId, outcome, BigInt(brierBps)]);
  }
  const txHash = mockTxHash("record", marketId, keccak256(encodePacked(["bool"], [outcome])));
  log.info("record", "simulated record (CHAIN_MODE=mock)", { txHash });
  return { txHash, mode: "mock" };
}

/** On-chain prediction status. Returns `None` in mock mode (no chain state). */
export async function readStatus(cfg: Config, marketId: Hex): Promise<OnChainStatus> {
  if (cfg.chainMode !== "amoy") return OnChainStatus.None;
  const { publicClient, contract } = amoyClients(cfg);
  const p = await publicClient.readContract({
    address: contract,
    abi: predictionRegistryAbi,
    functionName: "getPrediction",
    args: [marketId],
  });
  return p.status as OnChainStatus;
}

/** Authoritative reputation from chain (amoy) or `null` in mock (caller computes). */
export async function readReputation(
  cfg: Config,
): Promise<{ resolvedCount: number; avgBrierBps: number } | null> {
  if (cfg.chainMode !== "amoy") return null;
  const { publicClient, contract } = amoyClients(cfg);
  const [count, avg] = await publicClient.readContract({
    address: contract,
    abi: predictionRegistryAbi,
    functionName: "getReputation",
  });
  return { resolvedCount: Number(count), avgBrierBps: Number(avg) };
}
