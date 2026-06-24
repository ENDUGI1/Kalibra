/** Minimal ABI for the functions the agent calls. Keep in sync with the contract. */
export const predictionRegistryAbi = [
  {
    type: "function",
    name: "commitPrediction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "predictionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revealPrediction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "probBps", type: "uint256" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recordOutcome",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "outcome", type: "bool" },
      { name: "brierScoreBps", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getReputation",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "count", type: "uint256" },
      { name: "avgBrierBps", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getPrediction",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "predictionHash", type: "bytes32" },
          { name: "committedAt", type: "uint64" },
          { name: "probBps", type: "uint32" },
          { name: "brierBps", type: "uint32" },
          { name: "outcome", type: "bool" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "Committed",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "predictionHash", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

/** Mirrors the contract's `Status` enum. */
export enum OnChainStatus {
  None = 0,
  Committed = 1,
  Revealed = 2,
  Resolved = 3,
}
