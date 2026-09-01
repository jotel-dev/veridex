/**
 * Vercel Serverless Function: GET /api/balance
 */

const { ethers } = require('ethers');

const NETWORKS_CONFIG = {
  mainnet: {
    name: 'Celo Mainnet',
    chainId: 42220,
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    token: {
      address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
      symbol: 'USA₮',
      decimals: 6
    }
  },
  sepolia: {
    name: 'Celo Sepolia Testnet',
    chainId: 11142220,
    rpcUrl: process.env.CELO_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org',
    token: {
      address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
      symbol: 'USDC',
      decimals: 6
    }
  }
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { address, network = 'mainnet' } = req.query;
    if (!address || !ethers.isAddress(address.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    const netCfg = NETWORKS_CONFIG[network] || NETWORKS_CONFIG.mainnet;
    const provider = new ethers.JsonRpcProvider(netCfg.rpcUrl);
    const tokenContract = new ethers.Contract(netCfg.token.address, ERC20_ABI, provider);

    const [balanceRaw, celoBalanceRaw] = await Promise.all([
      tokenContract.balanceOf(address).catch(() => 0n),
      provider.getBalance(address).catch(() => 0n)
    ]);

    const formattedToken = ethers.formatUnits(balanceRaw, netCfg.token.decimals);
    const formattedCelo = ethers.formatEther(celoBalanceRaw);

    res.status(200).json({
      success: true,
      address,
      network,
      tokenSymbol: netCfg.token.symbol,
      tokenBalance: formattedToken,
      rawTokenBalance: balanceRaw.toString(),
      celoBalance: formattedCelo,
      tokenAddress: netCfg.token.address
    });
  } catch (err) {
    console.error('Error in /api/balance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
