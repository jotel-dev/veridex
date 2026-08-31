/**
 * Inspect Sepolia USDC contract for public mint/faucet/owner
 */

const { ethers } = require('ethers');

async function inspectUSDC() {
  const rpcUrl = 'https://forno.celo-sepolia.celo-testnet.org';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const usdcAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E';

  // Let's test calling mint(address,uint256) or faucet() or similar
  const testFunctions = [
    'function mint(address to, uint256 amount)',
    'function mint(uint256 amount)',
    'function faucet()',
    'function drip(address to)',
    'function owner() view returns (address)',
    'function masterMinter() view returns (address)',
    'function minterAllowance(address minter) view returns (uint256)'
  ];

  for (const fn of testFunctions) {
    try {
      const iface = new ethers.Interface([fn]);
      const name = fn.split('(')[0].replace('function ', '');
      const contract = new ethers.Contract(usdcAddress, [fn], provider);
      if (fn.includes('view')) {
        let res;
        if (fn.includes('minterAllowance')) {
          res = await contract.minterAllowance('0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321');
        } else {
          res = await contract[name]();
        }
        console.log(`[VIEW] ${name}:`, res);
      }
    } catch (e) {
      console.log(`[FAIL] ${fn}:`, e.shortMessage || e.message);
    }
  }
}

inspectUSDC().catch(console.error);
