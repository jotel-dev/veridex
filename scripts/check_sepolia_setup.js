/**
 * Inspect x402 supported testnet tokens on Celo Sepolia
 */

const { ethers } = require('ethers');

async function checkTestnetTokens() {
  const configRes = await fetch('https://x402.celo.org/api/config');
  const config = await configRes.json();
  console.log('x402 Config Tokens:', JSON.stringify(config.tokens, null, 2));

  const suppRes = await fetch('https://api.x402.sepolia.celo.org/supported');
  const supported = await suppRes.json();
  console.log('\nTestnet /supported:', JSON.stringify(supported, null, 2));

  // Check Celo Sepolia RPC connection
  const provider = new ethers.JsonRpcProvider('https://forno.celo-sepolia.celo-testnet.org');
  const net = await provider.getNetwork();
  console.log(`\nConnected to Celo Sepolia! Chain ID: ${net.chainId}`);

  const agentWallet = '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321';
  const balance = await provider.getBalance(agentWallet);
  console.log(`Agent Wallet Balance on Sepolia: ${ethers.formatEther(balance)} CELO`);
}

checkTestnetTokens().catch(console.error);
