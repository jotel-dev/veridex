/**
 * Veridex SafeSend - Stablecoin (USA₮) Transfer Execution Service
 * 
 * Executes gas-sponsored USA₮ transfers on Celo with ERC-8021 on-chain
 * attribution tags attached to the transaction data suffix.
 */

const { ethers } = require('ethers');
const { toDataSuffix } = require('@celo/attribution-tags');
const { AgentWallet } = require('../agent/agentWallet');
const { X402FacilitatorClient } = require('./x402Client');
const { HACKATHON, NETWORKS } = require('../config/constants');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Token Addresses on Celo
const TOKENS = {
  CELO_MAINNET: {
    USAT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', // Official Tether USD (USA₮) on Celo
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a'
  },
  CELO_SEPOLIA: {
    USAT: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
  }
};

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external'
];

class TransferService {
  /**
   * @param {object} [options]
   * @param {string} [options.tokenAddress]
   * @param {number} [options.tokenDecimals]
   * @param {string} [options.attributionTag]
   */
  constructor(options = {}) {
    this.agentWallet = new AgentWallet();
    this.signer = this.agentWallet.getSigner();
    this.provider = this.agentWallet.getProvider();
    
    this.tokenAddress = options.tokenAddress || TOKENS.CELO_MAINNET.USAT;
    this.tokenDecimals = options.tokenDecimals || 6;
    this.tokenSymbol = options.tokenSymbol || 'USA₮';

    // Retrieve attribution tag from config/hackathon.json or constants or env
    this.attributionTag = options.attributionTag || this.loadAttributionTag();
    this.x402Client = new X402FacilitatorClient('mainnet');
  }

  /**
   * Load attribution tag
   */
  loadAttributionTag() {
    try {
      const configPath = path.resolve(__dirname, '../../config/hackathon.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.attributionTag) {
          return config.attributionTag;
        }
      }
    } catch (e) {}
    return process.env.CELO_ATTRIBUTION_TAG || HACKATHON.ATTRIBUTION_TAG || 'celo_ef9178addda4';
  }

  /**
   * Generate ERC-8021 Data Suffix for attribution
   * @returns {string} - Hex string suffix with ERC-8021 marker
   */
  getAttributionDataSuffix() {
    return toDataSuffix(['veridex', this.attributionTag]);
  }

  /**
   * Execute sponsored USA₮ transfer on Celo with attribution tag
   * @param {object} params
   * @param {string} params.recipient - Destination EVM address
   * @param {number|string} params.amount - Amount in token units (e.g. 1.5)
   * @param {boolean} [params.simulateOnly] - If true, only simulate gas and data
   * @returns {Promise<object>}
   */
  async executeSponsoredTransfer({ recipient, amount, simulateOnly = false }) {
    if (!ethers.isAddress(recipient)) {
      throw new Error(`Invalid recipient EVM address: ${recipient}`);
    }

    const parsedAmount = ethers.parseUnits(amount.toString(), this.tokenDecimals);
    const tokenContract = new ethers.Contract(this.tokenAddress, ERC20_ABI, this.signer);

    // 1. Build standard ERC-20 transfer calldata
    const baseCalldata = tokenContract.interface.encodeFunctionData('transfer', [recipient, parsedAmount]);

    // 2. Append ERC-8021 attribution suffix
    const attributionSuffix = this.getAttributionDataSuffix();
    // remove '0x' prefix from suffix and append to base calldata
    const suffixedCalldata = baseCalldata + attributionSuffix.slice(2);

    console.log(`[SafeSend Transfer] Recipient: ${recipient}`);
    console.log(`[SafeSend Transfer] Amount: ${amount} ${this.tokenSymbol} (${parsedAmount.toString()} raw)`);
    console.log(`[SafeSend Transfer] Attribution Tag: ${this.attributionTag}`);
    console.log(`[SafeSend Transfer] Data Suffix Attached: ${attributionSuffix}`);

    // If simulation requested, return prepared transaction payload
    if (simulateOnly) {
      const estimatedGas = await this.provider.estimateGas({
        from: this.agentWallet.getAddress(),
        to: this.tokenAddress,
        data: suffixedCalldata
      }).catch(() => 65000n);

      return {
        simulated: true,
        recipient,
        amount: amount.toString(),
        token: this.tokenSymbol,
        tokenAddress: this.tokenAddress,
        sponsorWallet: this.agentWallet.getAddress(),
        attributionTag: this.attributionTag,
        dataSuffix: attributionSuffix,
        estimatedGas: estimatedGas.toString()
      };
    }

    // Check sponsor wallet balance
    const sponsorBalance = await this.agentWallet.getBalance();
    if (sponsorBalance.wei === 0n) {
      throw new Error(`Agent sponsor wallet (${this.agentWallet.getAddress()}) has 0 CELO to pay gas.`);
    }

    // 3. Broadcast gas-sponsored transaction with attribution tag
    const tx = await this.signer.sendTransaction({
      to: this.tokenAddress,
      data: suffixedCalldata,
      gasLimit: 120000n
    });

    console.log(`[SafeSend Transfer] Transaction submitted: ${tx.hash}`);
    console.log(`[SafeSend Transfer] Explorer: https://celoscan.io/tx/${tx.hash}`);

    const receipt = await tx.wait(1);

    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      recipient,
      amount: amount.toString(),
      token: this.tokenSymbol,
      tokenAddress: this.tokenAddress,
      sponsorWallet: this.agentWallet.getAddress(),
      attributionTag: this.attributionTag,
      explorerUrl: `https://celoscan.io/tx/${tx.hash}`
    };
  }

  /**
   * Execute x402 Facilitator Settlement
   */
  async executeX402Settlement({ authorizationPayload }) {
    return this.x402Client.settlePayment(authorizationPayload);
  }
}

module.exports = {
  TransferService,
  TOKENS
};
