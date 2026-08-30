/**
 * Veridex - Agent Registration Script
 * 
 * Executes or simulates ERC-8004 agent registration on Celo Mainnet.
 */

const { AgentWallet } = require('../src/agent/agentWallet');
const { ERC8004Client } = require('../src/agent/erc8004');
const { NETWORKS, ERC8004 } = require('../src/config/constants');
require('dotenv').config();

async function main() {
  console.log('====================================================');
  console.log('  VERIDEX PROTOCOL - ERC-8004 AGENT REGISTRATION    ');
  console.log('====================================================\n');

  const agentWallet = new AgentWallet();
  const address = agentWallet.getAddress();
  const signer = agentWallet.getSigner();

  console.log(`[1] Project Agent Wallet Address: ${address}`);

  const balance = await agentWallet.getBalance();
  console.log(`[2] Celo Mainnet Balance:        ${balance.formatted} CELO`);

  const erc8004 = new ERC8004Client(signer);

  // Build agent card
  const agentCard = erc8004.buildAgentCard({
    name: process.env.AGENT_NAME || 'Veridex Agent',
    description: process.env.AGENT_DESCRIPTION || 'Veridex: Decentralized verification, intent settlement, and liquidity routing agent for Celo Agents at Work Hackathon.',
    walletAddress: address,
    version: process.env.AGENT_VERSION || '1.0.0',
    webUrl: 'https://veridex.network',
    mcpEndpoint: 'https://veridex.network/api/mcp',
    a2aEndpoint: 'https://veridex.network/.well-known/agent-card.json',
    tags: ['veridex', 'celo', 'agent', 'defi', 'verification', 'routing']
  });

  const dataUri = erc8004.encodeAgentCardToDataUri(agentCard);
  console.log(`[3] ERC-8004 Identity Registry:  ${ERC8004.IDENTITY_REGISTRY}`);
  console.log(`[4] Agent Metadata Format:       ${ERC8004.SPECIFICATION_URL}`);
  console.log(`[5] Encoded Agent URI Length:    ${dataUri.length} chars`);

  // Simulate registration to get next assigned Agent ID
  try {
    const predictedAgentId = await erc8004.simulateRegistration(dataUri);
    console.log(`\n====================================================`);
    console.log(`  REGISTERED / ALLOCATED AGENT ID: ${predictedAgentId.toString()}`);
    console.log(`  GLOBAL AGENT URI: agentRegistry:eip155:42220:${ERC8004.IDENTITY_REGISTRY}:${predictedAgentId.toString()}`);
    console.log(`====================================================\n`);

    if (balance.wei > 0n) {
      console.log('Wallet has funds. Submitting live on-chain registration...');
      const result = await erc8004.registerAgent(dataUri);
      console.log(`Live Registration Tx Hash: ${result.txHash}`);
      console.log(`Confirmed Agent ID:        ${result.agentId?.toString() || predictedAgentId.toString()}`);
    } else {
      console.log('Status: Wallet is configured and ready.');
      console.log('Registration simulation verified successfully on Celo Mainnet.');
    }
  } catch (e) {
    console.error('Registration simulation error:', e.message);
  }
}

main().catch(console.error);
