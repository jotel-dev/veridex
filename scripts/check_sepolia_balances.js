/**
 * Check balances on Celo Sepolia
 */

const { ethers } = require('ethers');

async function checkBalances() {
  const rpcUrl = 'https://forno.celo-sepolia.celo-testnet.org';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const agentWallet = '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321';
  const testUser = '0xF0f815Fa6e862Dc690F9C650B24b93F4f3b0387d';
  const usdcAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E';

  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ];
  const usdc = new ethers.Contract(usdcAddress, erc20Abi, provider);

  const agentCelo = await provider.getBalance(agentWallet);
  const testUserCelo = await provider.getBalance(testUser);

  const [agentUsdc, testUserUsdc, sym, dec] = await Promise.all([
    usdc.balanceOf(agentWallet).catch(() => 0n),
    usdc.balanceOf(testUser).catch(() => 0n),
    usdc.symbol().catch(() => 'USDC'),
    usdc.decimals().catch(() => 6)
  ]);

  console.log(`Agent Wallet (${agentWallet}):`);
  console.log(`  CELO: ${ethers.formatEther(agentCelo)} CELO`);
  console.log(`  ${sym}: ${ethers.formatUnits(agentUsdc, dec)} ${sym}`);

  console.log(`\nTest User (${testUser}):`);
  console.log(`  CELO: ${ethers.formatEther(testUserCelo)} CELO`);
  console.log(`  ${sym}: ${ethers.formatUnits(testUserUsdc, dec)} ${sym}`);
}

checkBalances().catch(console.error);
