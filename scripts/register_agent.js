/**
 * Veridex - Agent Registration Script (Live On-Chain)
 * 
 * Submits a live transaction to register Veridex on the ERC-8004 Identity Registry
 * contract on Celo Mainnet (Chain ID 42220).
 */

const { ethers } = require('ethers');
const { AgentWallet } = require('../src/agent/agentWallet');
const { ERC8004Client } = require('../src/agent/erc8004');
const { ERC8004, NETWORKS } = require('../src/config/constants');
const { RPC_ENDPOINTS } = require('../src/utils/provider');
require('dotenv').config();

async function main() {
  console.log('====================================================');
  console.log('  VERIDEX - LIVE ERC-8004 ON-CHAIN REGISTRATION     ');
  console.log('====================================================\n');

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY is missing in .env');
  }

  let provider = null;
  let signer = null;
  let activeRpc = null;

  for (const rpc of RPC_ENDPOINTS) {
    try {
      const p = new ethers.JsonRpcProvider(rpc, { chainId: 42220, name: 'celo' }, { staticNetwork: true });
      const b = await p.getBalance('0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321');
      provider = p;
      activeRpc = rpc;
      signer = new ethers.Wallet(privateKey, provider);
      break;
    } catch (e) {
      console.log(`RPC [${rpc}] connection attempt failed, trying next...`);
    }
  }

  if (!provider || !signer) {
    throw new Error('Could not connect to any Celo Mainnet RPC');
  }

  const address = signer.address;

  console.log(`[1] Network:                 Celo Mainnet (Chain ID: 42220)`);
  console.log(`[2] Active RPC:              ${activeRpc}`);
  console.log(`[3] Agent Wallet Address:    ${address}`);
  console.log(`[4] Target Registry:         ${ERC8004.IDENTITY_REGISTRY}`);

  // 1. Check live balance
  const balance = await provider.getBalance(address);
  console.log(`[5] Current Wallet Balance:  ${ethers.formatEther(balance)} CELO (${balance.toString()} Wei)`);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits('202.5', 'gwei');
  console.log(`[6] Current Gas Price:       ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);

  // Build metadata
  const erc8004 = new ERC8004Client(signer);
  const agentCard = erc8004.buildAgentCard({
    name: process.env.AGENT_NAME || 'Veridex',
    description: process.env.AGENT_DESCRIPTION || 'Veridex is a scam-detection gate that checks messages, links, and addresses for fraud signals before executing a stablecoin (USA₮) transfer over x402, with sponsored gas.',
    walletAddress: address,
    version: process.env.AGENT_VERSION || '1.0.0',
    webUrl: 'https://veridex.network',
    mcpEndpoint: 'https://veridex.network/api/mcp',
    a2aEndpoint: 'https://veridex.network/.well-known/agent-card.json',
    tags: ['veridex', 'celo', 'scam-detection', 'anti-fraud', 'x402', 'sponsored-gas', 'usat', 'stablecoins']
  });

  const dataUri = erc8004.encodeAgentCardToDataUri(agentCard);
  console.log(`[7] Metadata Size:           ${dataUri.length} characters (base64 data URI)`);

  const regFn = erc8004.contract.getFunction('register(string)');

  // Estimate dynamic gas
  const estimatedGas = await regFn.estimateGas(dataUri);
  const gasLimit = (estimatedGas * 130n) / 100n; // 30% safety buffer
  console.log(`[8] Estimated Gas:           ${estimatedGas.toString()} (Gas Limit with buffer: ${gasLimit.toString()})`);

  const totalEstimatedCost = gasLimit * gasPrice;
  console.log(`[9] Total Estimated Cost:    ${ethers.formatEther(totalEstimatedCost)} CELO\n`);

  if (balance < totalEstimatedCost) {
    console.error('❌ Insufficient balance to cover registration gas.');
    process.exit(1);
  }

  // 2. Broadcast real transaction to Celo Mainnet
  console.log('🚀 Broadcasting live registration transaction to Celo Mainnet...');

  const tx = await regFn(dataUri, {
    gasLimit: gasLimit
  });

  console.log(`\nTransaction submitted!`);
  console.log(`Transaction Hash: ${tx.hash}`);
  console.log(`Explorer:         https://celoscan.io/tx/${tx.hash}`);
  console.log(`Waiting for block confirmation...`);

  const receipt = await tx.wait(1);
  console.log(`\n✅ Transaction confirmed in Block #${receipt.blockNumber}!`);
  console.log(`Status:           SUCCESS (status: ${receipt.status})`);
  console.log(`Gas Used:         ${receipt.gasUsed.toString()}`);

  // 3. Parse confirmed Agent ID from receipt logs
  let confirmedAgentId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = erc8004.contract.interface.parseLog(log);
      if (parsed && (parsed.name === 'Registered' || parsed.name === 'Transfer')) {
        confirmedAgentId = parsed.args.agentId || parsed.args.tokenId;
        break;
      }
    } catch (e) {}
  }

  if (confirmedAgentId) {
    console.log(`\n====================================================`);
    console.log(`  🎉 OFFICIAL ON-CHAIN ERC-8004 AGENT ID: ${confirmedAgentId.toString()}`);
    console.log(`  GLOBAL AGENT URI: agentRegistry:eip155:42220:${ERC8004.IDENTITY_REGISTRY}:${confirmedAgentId.toString()}`);
    console.log(`  CELOSCAN TX:      https://celoscan.io/tx/${tx.hash}`);
    console.log(`  8004SCAN URL:     https://8004scan.io/agents/celo/${confirmedAgentId.toString()}`);
    console.log(`====================================================\n`);
  } else {
    console.log(`Warning: Could not parse Agent ID directly from logs. Check tx: https://celoscan.io/tx/${tx.hash}`);
  }
}

main().catch((err) => {
  console.error('\n❌ Execution Error:', err.message);
  process.exit(1);
});
