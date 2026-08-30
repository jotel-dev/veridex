/**
 * Veridex - Agent Verification Script
 * 
 * Resolves an ERC-8004 Agent ID on Celo Mainnet and prints its details.
 */

const { ethers } = require('ethers');
const { ERC8004Client } = require('../src/agent/erc8004');
const { ERC8004 } = require('../src/config/constants');
const { RPC_ENDPOINTS } = require('../src/utils/provider');
require('dotenv').config();

async function main() {
  const agentId = process.argv[2] || 9797;
  
  let provider = null;
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const p = new ethers.JsonRpcProvider(rpc, { chainId: 42220, name: 'celo' }, { staticNetwork: true });
      await p.getBlockNumber();
      provider = p;
      break;
    } catch (e) {}
  }

  if (!provider) {
    provider = new ethers.JsonRpcProvider('https://forno.celo.org', { chainId: 42220, name: 'celo' }, { staticNetwork: true });
  }

  const client = new ERC8004Client(provider);

  console.log(`Resolving Agent ID: ${agentId} on ${ERC8004.IDENTITY_REGISTRY}...`);
  try {
    const result = await client.resolveAgent(agentId);
    console.log('\n--- RESOLVED ON-CHAIN AGENT DATA ---');
    console.log(`Owner:     ${result.owner}`);
    console.log(`Token URI: ${result.uri.slice(0, 80)}...`);
    console.log('\nDecoded Agent Card:');
    console.log(JSON.stringify(result.metadata, null, 2));
  } catch (e) {
    console.error('Error resolving agent:', e.message);
  }
}

main().catch(console.error);
