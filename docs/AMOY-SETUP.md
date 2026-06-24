# Setting up Polygon Amoy (testnet) for the on-chain commit

Phase 0 runs with `CHAIN_MODE=mock` (no key needed). Follow this to land a **real**
`commitPrediction` transaction on Amoy. None of this requires real money — Amoy is a free testnet.

## 1. Get an RPC endpoint

Either works:

- **Public (zero setup):** `https://rpc-amoy.polygon.technology`
- **Private (more reliable):** create a free app on [Alchemy](https://www.alchemy.com/) or
  [Infura](https://www.infura.io/), pick network **Polygon Amoy**, copy the HTTPS URL.

## 2. Create a throwaway dev wallet

**Do not reuse a personal/mainnet key.** Generate a fresh key just for dev:

```bash
# with Foundry (already installed):
cast wallet new
# prints an address and a private key — copy both
```

Keep the private key only in `apps/agent/.env` and `contracts/.env` (both git-ignored).
Never paste it into chat, commits, or screenshots.

## 3. Fund it from the faucet

Go to the [Polygon faucet](https://faucet.polygon.technology/), select **Amoy**, paste your dev
address, request test POL/MATIC. You need only a tiny amount for gas.

Verify the balance:

```bash
cast balance <your-address> --rpc-url https://rpc-amoy.polygon.technology
```

## 4. Deploy the contract

```bash
cd contracts
cp .env.example .env          # set RPC_URL and PRIVATE_KEY
set -a; source .env; set +a
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
# note the printed "PredictionRegistry deployed at: 0x...."
```

The deploying address becomes the contract `owner` (the only address allowed to commit). Use the
**same** key for the agent.

## 5. Point the agent at Amoy

In `apps/agent/.env`:

```bash
CHAIN_MODE=amoy
RPC_URL=https://rpc-amoy.polygon.technology     # or your Alchemy/Infura URL
PRIVATE_KEY=0x...                               # same dev key that deployed
CONTRACT_ADDRESS=0x...                          # from step 4
```

Then:

```bash
pnpm agent:run
```

The agent submits `commitPrediction` for each actionable market and waits for the receipt. The
dashboard's Tx column will link to `amoy.polygonscan.com` for each commit.

## Checklist

- [ ] RPC URL reachable
- [ ] Dev key generated (kept out of git)
- [ ] Address funded (faucet)
- [ ] Contract deployed; address copied
- [ ] `apps/agent/.env` set to `CHAIN_MODE=amoy` with matching key
- [ ] `pnpm agent:run` lands a tx visible on Amoy PolygonScan
