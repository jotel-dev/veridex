# Veridex - Celo Agents at Work Hackathon

Veridex is a scam-detection gate that checks messages, links, and recipient addresses for fraud signals before executing a stablecoin (USA₮) transfer over x402, with sponsored gas.

## Project Agent Wallet & ERC-8004 Identity

- **Network:** Celo Mainnet (`eip155:42220`)
- **Agent Wallet Address:** `0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321`
- **ERC-8004 Identity Registry:** [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
- **ERC-8004 Reputation Registry:** [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
- **Allocated Agent ID:** `9797`
- **Global Agent URI:** `agentRegistry:eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:9797`
- **Attribution Tag:** `celo_ef9178addda4`
- **Hackathon Track:** Track 2 - Real World Adoption (Best Stablecoin Adoption subtrack)
- **Chainstack Coupon Code:** `AGENTSATWORK` (3 months free Growth plan on Celo Mainnet)
- **Metadata Standard:** [EIP-8004 Registration v1](https://eips.ethereum.org/EIPS/eip-8004#registration-v1)

> **Important Hackathon Rule:**  
> This agent wallet is strictly for the project's autonomous actions and protocol operations. It **must never** be used to fund or send transactions to test user wallets, ensuring realistic and independent scoring data.

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
The project credentials are saved in `.env` (automatically gitignored). See `.env.example` for the required configuration parameters.

### 3. Run SafeSend Pipeline & Test Suite
```bash
# Run the SafeSend security & transfer test suite
npm test

# Test RPC connection against configured Chainstack endpoint
npm run test:rpc

# Register agent or verify allocation on Celo Mainnet
npm run agent:register

# Inspect any registered ERC-8004 agent by ID
npm run agent:verify 9797
```

## SafeSend Pipeline Architecture

SafeSend is a fraud-prevention gate for stablecoin transfers on Celo:

1. **Intake**: Parses forwarded messages, URLs, or explicit transfer intents (`{ recipient, amount }`).
2. **Scam Detection**: Multi-layer heuristic analyzer for:
   - Suspicious URLs, URL shorteners, lookalike/typosquatting domains, high-risk TLDs (`.zip`, `.mov`, etc.).
   - Urgency and coercion patterns ("act now", "account suspended").
   - Fake airdrops and reward lures ("you've won", "free 1000 USDT").
   - Phishing & credential theft attempts (seed phrases, private keys).
   - Claude LLM fallback for ambiguous cases.
3. **Security Gate**:
   - `HIGH RISK`: Blocks flow, halts execution, returns structured risk report & TTS audio alert.
   - `LOW / MEDIUM RISK`: Clears gate and proceeds to execution.
4. **Sponsored USA₮ Transfer & Attribution**:
   - Transfers USA₮ on Celo using the project Agent Wallet.
   - Sponsoring gas (recipient / user does not pay gas).
   - Integrates with x402 facilitator for gasless settlement.
   - Attaches ERC-8021 on-chain attribution tag `celo_ef9178addda4` via `@celo/attribution-tags` (`toDataSuffix(['veridex', attributionTag])`).

