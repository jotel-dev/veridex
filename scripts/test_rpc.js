/**
 * Test Celo RPC Connection
 * 
 * Verifies connectivity, chain ID, block number, and latency against
 * the configured CELO_RPC_URL (Chainstack).
 */

const { ethers } = require('ethers');
const { getCeloProvider } = require('../src/utils/provider');
require('dotenv').config();

async function testRpc() {
  console.log('====================================================');
  console.log('  TESTING CELO MAINNET RPC CONNECTION               ');
  console.log('====================================================\n');

  const rpcUrl = process.env.CELO_RPC_URL;
  if (!rpcUrl) {
    console.error('❌ CELO_RPC_URL is not set in .env');
    process.exit(1);
  }

  // Mask sensitive key in URL for display
  let maskedUrl = rpcUrl;
  try {
    const parts = rpcUrl.split('/');
    const key = parts[parts.length - 1];
    if (key.length > 8) {
      parts[parts.length - 1] = `${key.slice(0, 4)}...${key.slice(-4)}`;
      maskedUrl = parts.join('/');
    }
  } catch (e) {}

  console.log(`[1] Configured RPC Endpoint: ${maskedUrl}`);

  const startTime = Date.now();
  const provider = getCeloProvider();

  try {
    const network = await provider.getNetwork();
    const latency = Date.now() - startTime;
    console.log(`[2] Connected Chain ID:      ${network.chainId.toString()} (${network.name})`);
    console.log(`[3] RPC Response Latency:    ${latency} ms`);

    const blockNumber = await provider.getBlockNumber();
    console.log(`[4] Latest Block Number:     #${blockNumber}`);

    const feeData = await provider.getFeeData();
    console.log(`[5] Current Gas Price:       ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} Gwei`);

    const address = process.env.AGENT_WALLET_ADDRESS || '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321';
    const balance = await provider.getBalance(address);
    console.log(`[6] Agent Wallet Balance:    ${ethers.formatEther(balance)} CELO`);

    console.log('\n====================================================');
    console.log('  ✅ RPC CONNECTION SUCCESSFUL & READY FOR WORK!     ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ RPC Connection Failed:', err.message);
    process.exit(1);
  }
}

testRpc().catch(console.error);
