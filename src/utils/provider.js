/**
 * RPC Provider Utility for Celo
 * 
 * Prioritizes process.env.CELO_RPC_URL (Chainstack) with configured timeouts
 * and fallback to redundant public endpoints.
 */

const { ethers } = require('ethers');
require('dotenv').config();

const FALLBACK_RPCS = [
  'https://forno.celo.org',
  'https://rpc.ankr.com/celo',
  'https://celo.drpc.org',
  'https://1rpc.io/celo'
];

function getRpcEndpoints() {
  const rpcs = [];
  if (process.env.CELO_RPC_URL) {
    rpcs.push(process.env.CELO_RPC_URL);
  }
  for (const r of FALLBACK_RPCS) {
    if (!rpcs.includes(r)) {
      rpcs.push(r);
    }
  }
  return rpcs;
}

function getCeloProvider(customRpc) {
  const rpcUrl = customRpc || process.env.CELO_RPC_URL || FALLBACK_RPCS[0];
  
  // Configure FetchRequest with 25s timeout for reliable connection
  const fetchReq = new ethers.FetchRequest(rpcUrl);
  fetchReq.timeout = 25000;
  fetchReq.setHeader('Content-Type', 'application/json');

  return new ethers.JsonRpcProvider(fetchReq, 42220, {
    staticNetwork: true
  });
}

module.exports = {
  getCeloProvider,
  getRpcEndpoints,
  RPC_ENDPOINTS: FALLBACK_RPCS
};
