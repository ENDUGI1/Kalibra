# contracts — PredictionRegistry

Foundry project for Kalibra's on-chain commit-reveal registry.

## Commands

```bash
forge build          # compile
forge test -vvv      # run the commit→reveal→record suite (11 tests)
forge fmt            # format
```

forge-std is vendored as a git submodule. After a fresh clone:

```bash
git submodule update --init --recursive
```

## Contract

`PredictionRegistry` (`src/PredictionRegistry.sol`) — owner-gated (the agent address):

| Function                                              | Effect                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `commitPrediction(marketId, predictionHash)`          | Stores hash + `block.timestamp`. Emits `Committed`.              |
| `revealPrediction(marketId, probBps, salt)`           | Verifies `keccak256(abi.encode(probBps, salt))`. Emits `Revealed`. |
| `recordOutcome(marketId, outcome, brierScoreBps)`     | Records result + Brier, updates reputation. Emits `Resolved`.    |
| `getReputation() → (count, avgBrierBps)`              | Aggregate calibration reputation.                                |

**Hash scheme:** the agent must hash with `keccak256(abi.encode(uint256 probBps, bytes32 salt))`
(equivalently `encodeAbiParameters([{type:'uint256'},{type:'bytes32'}], [probBps, salt])` in viem).
Probabilities and Brier scores are basis points (0..10000).

## Deploy to Amoy

```bash
cp .env.example .env        # fill RPC_URL + PRIVATE_KEY (funded dev key)
set -a; source .env; set +a
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
```

Copy the printed address into `apps/agent/.env` as `CONTRACT_ADDRESS`.
