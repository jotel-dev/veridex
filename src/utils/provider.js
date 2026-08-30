/**
 * Multi-RPC Fallback Provider for Celo
 */

const { ethers } = require('ethers');
const { NETWORKS } = require('../config/constants');

const DEFAULT_RPCS = [
  'https://1rpc.io/celo',
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
  'https://celo.drpc.org'
];

function getCeloProvider(customRpc) {
  const rpc = customRpc || DEFAULT_RPCS[0];
  return new ethers.JsonRpcProvider(rpc, {
    chainId: 42220,
    name: 'celo'
  }, { staticNetwork: true, batchMaxCount: 1 });
}

module.exports = {
  getCeloProvider,
  DEFAULT_RPCS
};
