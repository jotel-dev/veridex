/**
 * ERC-8004 Trustless AI Agent Identity Client
 * 
 * Implements the ERC-8004 identity registration standard on Celo Mainnet:
 * - Metadata builder compliant with eip-8004#registration-v1
 * - Agent registration on IdentityRegistry (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
 * - Agent identity resolution and tokenURI parsing
 */

const { ethers } = require('ethers');
const { ERC8004, ABI, NETWORKS } = require('../config/constants');

class ERC8004Client {
  /**
   * @param {ethers.Signer|ethers.Provider} signerOrProvider 
   * @param {string} [registryAddress] 
   */
  constructor(signerOrProvider, registryAddress = ERC8004.IDENTITY_REGISTRY) {
    this.registryAddress = registryAddress;
    this.contract = new ethers.Contract(registryAddress, ABI.IDENTITY_REGISTRY, signerOrProvider);
    this.signerOrProvider = signerOrProvider;
  }

  /**
   * Build an ERC-8004 compliant Agent Card (JSON metadata)
   * @param {object} params
   * @param {string} params.name
   * @param {string} params.description
   * @param {string} params.walletAddress
   * @param {string} [params.version]
   * @param {string} [params.webUrl]
   * @param {string} [params.mcpEndpoint]
   * @param {string} [params.a2aEndpoint]
   * @param {string[]} [params.tags]
   * @returns {object}
   */
  buildAgentCard({
    name = 'Veridex Agent',
    description = 'Veridex: Decentralized verification, intent settlement, and liquidity routing agent for Celo Agents at Work Hackathon.',
    walletAddress,
    version = '1.0.0',
    webUrl = 'https://veridex.network',
    mcpEndpoint = 'https://veridex.network/api/mcp',
    a2aEndpoint = 'https://veridex.network/.well-known/agent-card.json',
    tags = ['veridex', 'celo', 'agent', 'defi', 'verification', 'routing']
  }) {
    return {
      type: ERC8004.SPECIFICATION_URL,
      name,
      description,
      version,
      platform: 'Veridex',
      active: true,
      services: [
        {
          name: 'agentWallet',
          endpoint: `eip155:42220:${walletAddress}`
        },
        ...(webUrl ? [{ name: 'web', endpoint: webUrl }] : []),
        ...(a2aEndpoint ? [{ name: 'a2a', endpoint: a2aEndpoint, version: '0.3.0' }] : []),
        ...(mcpEndpoint ? [{ name: 'mcp', endpoint: mcpEndpoint, version: '2025-03-26' }] : [])
      ],
      supportedTrust: ['reputation'],
      tags,
      updatedAt: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Encode agent card to data URI (base64)
   * @param {object} agentCard 
   * @returns {string}
   */
  encodeAgentCardToDataUri(agentCard) {
    const jsonString = JSON.stringify(agentCard);
    return `data:application/json;base64,${Buffer.from(jsonString).toString('base64')}`;
  }

  /**
   * Simulate registration and predict the assigned Agent ID
   * @param {string} agentUri
   * @returns {Promise<bigint>}
   */
  async simulateRegistration(agentUri) {
    const regFn = this.contract.getFunction('register(string)');
    return regFn.staticCall(agentUri);
  }

  /**
   * Execute live on-chain registration transaction
   * @param {string} agentUri
   * @returns {Promise<{ txHash: string, agentId: bigint, receipt: any }>}
   */
  async registerAgent(agentUri) {
    const regFn = this.contract.getFunction('register(string)');
    const tx = await regFn(agentUri);
    const receipt = await tx.wait();
    
    // Extract Agent ID from Registered or Transfer event
    let agentId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog(log);
        if (parsed && (parsed.name === 'Registered' || parsed.name === 'Transfer')) {
          agentId = parsed.args.agentId || parsed.args.tokenId;
          break;
        }
      } catch (e) {}
    }

    return {
      txHash: tx.hash,
      agentId,
      receipt
    };
  }

  /**
   * Resolve an Agent ID to its on-chain owner and metadata
   * @param {number|bigint|string} agentId 
   * @returns {Promise<{ owner: string, uri: string, metadata: object|null }>}
   */
  async resolveAgent(agentId) {
    const owner = await this.contract.ownerOf(agentId);
    const uri = await this.contract.tokenURI(agentId);
    
    let metadata = null;
    try {
      if (uri.startsWith('data:application/json;base64,')) {
        const jsonStr = Buffer.from(uri.split(',')[1], 'base64').toString('utf-8');
        metadata = JSON.parse(jsonStr);
      } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const res = await fetch(uri);
        metadata = await res.json();
      }
    } catch (e) {
      metadata = { raw: uri, parseError: e.message };
    }

    return {
      owner,
      uri,
      metadata
    };
  }
}

module.exports = {
  ERC8004Client
};
