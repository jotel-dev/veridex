/**
 * Veridex Protocol - Constants & Network Configuration
 */

module.exports = {
  NETWORKS: {
    CELO_MAINNET: {
      chainId: 42220,
      name: 'Celo Mainnet',
      rpcUrls: [
        'https://forno.celo.org',
        'https://1rpc.io/celo',
        'https://rpc.ankr.com/celo',
        'https://celo.drpc.org'
      ],
      blockExplorer: 'https://celoscan.io',
      nativeCurrency: {
        name: 'CELO',
        symbol: 'CELO',
        decimals: 18
      }
    },
    CELO_SEPOLIA: {
      chainId: 11142220,
      name: 'Celo Sepolia Testnet',
      rpcUrls: [
        'https://forno.celo-sepolia.celo-testnet.org',
        'https://celo-sepolia.drpc.org'
      ],
      blockExplorer: 'https://sepolia.celoscan.io',
      nativeCurrency: {
        name: 'CELO',
        symbol: 'CELO',
        decimals: 18
      }
    }
  },

  ERC8004: {
    // Canonical ERC-8004 Identity Registry on Celo Mainnet
    IDENTITY_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    // Canonical ERC-8004 Reputation Registry on Celo Mainnet
    REPUTATION_REGISTRY: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    SPECIFICATION_URL: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    VERSION: '1.0.0'
  },

  ABI: {
    IDENTITY_REGISTRY: [
      'function register() external returns (uint256)',
      'function register(string calldata agentURI) external returns (uint256)',
      'function register(string calldata agentURI, tuple(string key, bytes value)[] calldata metadata) external returns (uint256)',
      'function setAgentURI(uint256 agentId, string calldata agentURI) external',
      'function setAgentWallet(uint256 agentId, address wallet, uint256 deadline, bytes calldata signature) external',
      'function unsetAgentWallet(uint256 agentId) external',
      'function ownerOf(uint256 tokenId) external view returns (address)',
      'function tokenURI(uint256 tokenId) external view returns (string)',
      'function getMetadata(uint256 agentId, string calldata key) external view returns (bytes)',
      'function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external',
      'function balanceOf(address owner) external view returns (uint256)',
      'function name() external view returns (string)',
      'function symbol() external view returns (string)',
      'function getVersion() external view returns (string)',
      'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
      'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
    ]
  },

  HACKATHON: {
    SLUG: 'agents-at-work',
    ATTRIBUTION_TAG: 'celo_ef9178addda4',
    CHAINSTACK_COUPON: 'AGENTSATWORK',
    PRIMARY_TRACK: 'real-world-adoption'
  }
};
