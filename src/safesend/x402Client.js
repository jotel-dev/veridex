/**
 * Veridex - x402 Facilitator Client
 * 
 * Interacts with Celo's native x402 Facilitator (api.x402.celo.org)
 * for gasless stablecoin settlement using EIP-3009 transferWithAuthorization.
 */

const { ethers } = require('ethers');
require('dotenv').config();

const X402_ENDPOINTS = {
  MAINNET: 'https://api.x402.celo.org',
  SEPOLIA: 'https://api.x402.sepolia.celo.org'
};

class X402FacilitatorClient {
  /**
   * @param {string} [network] - 'mainnet' | 'sepolia'
   * @param {string} [apiKey] - Optional x402 API key
   */
  constructor(network = 'mainnet', apiKey = process.env.X402_API_KEY) {
    this.baseUrl = network === 'sepolia' ? X402_ENDPOINTS.SEPOLIA : X402_ENDPOINTS.MAINNET;
    this.apiKey = apiKey;
  }

  /**
   * Query supported schemes, tokens, and networks
   * @returns {Promise<object>}
   */
  async getSupported() {
    const res = await fetch(`${this.baseUrl}/supported`);
    if (!res.ok) {
      throw new Error(`x402 /supported failed with status ${res.status}`);
    }
    return res.json();
  }

  /**
   * Verify an x402 payment authorization before submitting
   * @param {object} paymentPayload 
   * @returns {Promise<{ valid: boolean, details: any }>}
   */
  async verifyPayment(paymentPayload) {
    try {
      const res = await fetch(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify(paymentPayload)
      });
      const data = await res.json();
      return {
        valid: res.ok,
        status: res.status,
        data
      };
    } catch (e) {
      return {
        valid: false,
        error: e.message
      };
    }
  }

  /**
   * Settle an x402 payment on-chain via the facilitator
   * @param {object} paymentPayload 
   * @returns {Promise<object>}
   */
  async settlePayment(paymentPayload) {
    const res = await fetch(`${this.baseUrl}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify(paymentPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`x402 settlement error (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
  }

  /**
   * Build EIP-712 EIP-3009 TransferWithAuthorization struct
   */
  static buildAuthorizationTypedData({
    tokenName = 'Tether USD',
    tokenAddress,
    chainId = 42220,
    from,
    to,
    value,
    validAfter = 0,
    validBefore = Math.floor(Date.now() / 1000) + 3600,
    nonce = ethers.hexlify(ethers.randomBytes(32))
  }) {
    const domain = {
      name: tokenName,
      version: '1',
      chainId,
      verifyingContract: tokenAddress
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const message = {
      from,
      to,
      value: value.toString(),
      validAfter,
      validBefore,
      nonce
    };

    return { domain, types, message };
  }
}

module.exports = {
  X402FacilitatorClient,
  X402_ENDPOINTS
};
