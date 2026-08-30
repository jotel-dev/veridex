/**
 * Veridex - Agent Verification Script
 * 
 * Resolves an ERC-8004 Agent ID on Celo Mainnet and prints its details.
 */

const { ERC8004Client } = require('../src/agent/erc8004');
const { getCeloProvider } = require('../src/utils/provider');
const { ERC8004 } = require('../src/config/constants');
require('dotenv').config();

async function main() {
  const agentId = process.argv[2] || 500;
  const provider = getCeloProvider(process.env.CELO_RPC_URL);
  const client = new ERC8004Client(provider);

  console.log(`Resolving Agent ID: ${agentId} on ${ERC8004.IDENTITY_REGISTRY}...`);
  try {
    const result = await client.resolveAgent(agentId);
    console.log('\n--- RESOLVED AGENT DATA ---');
    console.log(`Owner: ${result.owner}`);
    console.log(`Token URI: ${result.uri.slice(0, 100)}...`);
    console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
  } catch (e) {
    console.error('Error resolving agent:', e.message);
  }
}

main().catch(console.error);
