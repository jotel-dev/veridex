/**
 * Vercel Serverless Function: GET /api/info
 */

const path = require('path');
const fs = require('fs');

const NETWORKS_CONFIG = {
  mainnet: {
    name: 'Celo Mainnet',
    chainId: 42220,
    networkWireName: 'celo',
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    explorer: 'https://celoscan.io',
    token: {
      address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
      symbol: 'USA₮',
      name: 'Tether USD',
      version: '1',
      decimals: 6
    }
  },
  sepolia: {
    name: 'Celo Sepolia Testnet',
    chainId: 11142220,
    networkWireName: 'celo-sepolia',
    rpcUrl: process.env.CELO_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org',
    explorer: 'https://sepolia.celoscan.io',
    token: {
      address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
      symbol: 'USDC',
      name: 'USDC',
      version: '2',
      decimals: 6
    }
  }
};

function getHackathonConfig() {
  try {
    const p = path.resolve(__dirname, '../config/hackathon.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {}
  return {
    attributionTag: process.env.CELO_ATTRIBUTION_TAG || 'celo_ef9178addda4',
    agentId: '9797',
    agentWallet: process.env.AGENT_WALLET_ADDRESS || '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321'
  };
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const config = getHackathonConfig();
  res.status(200).json({
    name: 'Veridex',
    tagline: 'Autonomous Scam-Detection Gate for Stablecoin Transfers on Celo',
    agentId: config.agentId || '9797',
    agentWallet: config.agentWallet || '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321',
    attributionTag: config.attributionTag || 'celo_ef9178addda4',
    networks: NETWORKS_CONFIG,
    version: '1.0.0'
  });
};
