const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateAndRegister() {
  const envPath = path.resolve(__dirname, '..', '.env');
  
  let privateKey = process.env.AGENT_PRIVATE_KEY;
  let wallet;

  if (privateKey && ethers.isHexString(privateKey, 32)) {
    wallet = new ethers.Wallet(privateKey);
    console.log('Loaded existing wallet from .env:', wallet.address);
  } else {
    wallet = ethers.Wallet.createRandom();
    privateKey = wallet.privateKey;
    console.log('Generated new project agent wallet:', wallet.address);
  }

  // Check Celo balance
  const rpcs = ['https://forno.celo.org', 'https://1rpc.io/celo', 'https://rpc.ankr.com/celo'];
  let provider;
  for (const rpc of rpcs) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      const net = await p.getNetwork();
      if (net.chainId === 42220n) {
        provider = p;
        break;
      }
    } catch (e) {}
  }

  if (!provider) {
    provider = new ethers.JsonRpcProvider('https://forno.celo.org');
  }

  const balance = await provider.getBalance(wallet.address);
  console.log(`Celo Mainnet Balance: ${ethers.formatEther(balance)} CELO`);

  // Write .env file
  const envContent = [
    `# Veridex Agent Wallet & Celo Network Configuration`,
    `AGENT_PRIVATE_KEY=${privateKey}`,
    `AGENT_WALLET_ADDRESS=${wallet.address}`,
    `CELO_RPC_URL=https://forno.celo.org`,
    `CHAIN_ID=42220`,
    `ERC8004_IDENTITY_REGISTRY=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`,
    `ERC8004_REPUTATION_REGISTRY=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`,
    `AGENT_NAME=Veridex`,
    `AGENT_DESCRIPTION="Veridex: Trustless verification, intent settlement, and liquidity routing agent for Celo"`,
    `AGENT_VERSION=1.0.0`,
    ``
  ].join('\n');

  fs.writeFileSync(envPath, envContent, { encoding: 'utf8', mode: 0o600 });
  console.log('Saved project wallet credentials to .env (mode 0600)');

  // Also create .env.example
  const exampleContent = [
    `# Veridex Agent Wallet & Celo Network Configuration`,
    `AGENT_PRIVATE_KEY=0x_YOUR_PROJECT_AGENT_PRIVATE_KEY_HERE`,
    `AGENT_WALLET_ADDRESS=0x_YOUR_PROJECT_AGENT_WALLET_ADDRESS_HERE`,
    `CELO_RPC_URL=https://forno.celo.org`,
    `CHAIN_ID=42220`,
    `ERC8004_IDENTITY_REGISTRY=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`,
    `ERC8004_REPUTATION_REGISTRY=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`,
    `AGENT_NAME=Veridex`,
    `AGENT_DESCRIPTION="Veridex: Trustless verification, intent settlement, and liquidity routing agent for Celo"`,
    `AGENT_VERSION=1.0.0`,
    ``
  ].join('\n');

  fs.writeFileSync(path.resolve(__dirname, '..', '.env.example'), exampleContent, 'utf8');
  console.log('Created .env.example with safe placeholders');
}

generateAndRegister();
