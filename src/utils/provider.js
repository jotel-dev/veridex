/**
 * Multi-RPC Fallback Provider for Celo
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
  'https://celo.drpc.org',
  'https://1rpc.io/celo'
];

function getCeloProvider(customRpc) {
  if (customRpc) {
    return new ethers.JsonRpcProvider(customRpc, { chainId: 42220, name: 'celo' }, { staticNetwork: true });
  }

  // Use reliable Celo endpoint
  return new ethers.JsonRpcProvider('https://forno.celo.org', {
    chainId: 42220,
    name: 'celo'
  }, { staticNetwork: true });
}

module.exports = {
  getCeloProvider,
  RPC_ENDPOINTS
};
