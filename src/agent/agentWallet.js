/**
 * Veridex Agent Wallet Management
 * 
 * Manages Celo-compatible wallet creation, loading from secure environment,
 * balance verification, and transaction signing.
 */

const { ethers } = require('ethers');
const { getCeloProvider } = require('../utils/provider');
require('dotenv').config();

class AgentWallet {
  /**
   * Initialize or load the project agent wallet
   * @param {string} [privateKey] - Optional private key (defaults to AGENT_PRIVATE_KEY from .env)
   * @param {string} [rpcUrl] - Optional RPC URL (defaults to CELO_RPC_URL)
   */
  constructor(privateKey = process.env.AGENT_PRIVATE_KEY, rpcUrl = process.env.CELO_RPC_URL) {
    this.provider = getCeloProvider(rpcUrl);
    
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    } else {
      this.wallet = ethers.Wallet.createRandom().connect(this.provider);
    }
  }

  /**
   * Get the wallet address
   * @returns {string}
   */
  getAddress() {
    return this.wallet.address;
  }

  /**
   * Get the wallet private key
   * @returns {string}
   */
  getPrivateKey() {
    return this.wallet.privateKey;
  }

  /**
   * Get native CELO balance
   * @returns {Promise<{ wei: bigint, formatted: string }>}
   */
  async getBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return {
      wei: balance,
      formatted: ethers.formatEther(balance)
    };
  }

  /**
   * Sign message with agent wallet
   * @param {string|Uint8Array} message 
   * @returns {Promise<string>}
   */
  async signMessage(message) {
    return this.wallet.signMessage(message);
  }

  /**
   * Get underlying ethers signer
   * @returns {ethers.Wallet}
   */
  getSigner() {
    return this.wallet;
  }

  /**
   * Get provider
   * @returns {ethers.JsonRpcProvider}
   */
  getProvider() {
    return this.provider;
  }
}

module.exports = {
  AgentWallet
};
