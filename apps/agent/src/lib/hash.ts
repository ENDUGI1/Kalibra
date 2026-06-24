import { randomBytes } from "node:crypto";
import { encodeAbiParameters, keccak256, parseAbiParameters, toHex } from "viem";
import type { Hex } from "viem";

/** Generate a random 32-byte salt as 0x-prefixed hex. */
export function generateSalt(): Hex {
  return toHex(randomBytes(32));
}

/**
 * Hash a prediction exactly as the contract does:
 *   keccak256(abi.encode(uint256 probBps, bytes32 salt))
 * The encoding must match `revealPrediction`'s check or the reveal will revert.
 */
export function hashPrediction(probBps: number, salt: Hex): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("uint256, bytes32"), [BigInt(probBps), salt]),
  );
}

/** Derive a deterministic bytes32 market id from a source string. */
export function toMarketId(sourceRef: string): Hex {
  return keccak256(toHex(sourceRef));
}
