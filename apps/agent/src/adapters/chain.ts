import {
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodePacked,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import type { Config } from "../config.js";
import { predictionRegistryAbi } from "../abi/predictionRegistry.js";
import { log } from "../lib/logger.js";

export interface CommitResult {
  txHash: Hex;
  mode: "mock" | "amoy";
}

/** Deterministic fake tx hash so mock runs are reproducible and traceable. */
function mockTxHash(marketId: Hex, predictionHash: Hex): Hex {
  return keccak256(encodePacked(["bytes32", "bytes32"], [marketId, predictionHash]));
}

async function commitOnAmoy(
  cfg: Config,
  marketId: Hex,
  predictionHash: Hex,
): Promise<CommitResult> {
  if (!cfg.privateKey) throw new Error("CHAIN_MODE=amoy requires PRIVATE_KEY");
  if (!cfg.contractAddress) throw new Error("CHAIN_MODE=amoy requires CONTRACT_ADDRESS");

  const account = privateKeyToAccount(cfg.privateKey as Hex);
  const transport = http(cfg.rpcUrl);
  const wallet = createWalletClient({ account, chain: polygonAmoy, transport });
  const publicClient = createPublicClient({ chain: polygonAmoy, transport });

  const txHash = await wallet.writeContract({
    address: cfg.contractAddress as Hex,
    abi: predictionRegistryAbi,
    functionName: "commitPrediction",
    args: [marketId, predictionHash],
  });
  log.info("commit", "tx submitted to Amoy, awaiting confirmation", { txHash });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`commit tx reverted: ${txHash}`);

  return { txHash, mode: "amoy" };
}

/** Commit a hashed prediction on-chain (or simulate it in mock mode). */
export async function commitPrediction(
  cfg: Config,
  marketId: Hex,
  predictionHash: Hex,
): Promise<CommitResult> {
  if (cfg.chainMode === "amoy") return commitOnAmoy(cfg, marketId, predictionHash);
  const txHash = mockTxHash(marketId, predictionHash);
  log.info("commit", "simulated commit (CHAIN_MODE=mock)", { txHash });
  return { txHash, mode: "mock" };
}
