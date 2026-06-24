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
    name: "getReputation",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "count", type: "uint256" },
      { name: "avgBrierBps", type: "uint256" },
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
