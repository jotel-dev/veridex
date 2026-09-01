/**
 * Veridex - REST API & Web Application Server
 * 
 * Exposes the Veridex security & transfer pipeline as a clean REST API
 * supporting interactive client-side MetaMask EIP-3009 signing and x402 settlement.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { ScamDetector } = require('../safesend/scamDetector');
const { X402FacilitatorClient } = require('../safesend/x402Client');
const { TransferService } = require('../safesend/transferService');
const { toDataSuffix } = require('@celo/attribution-tags');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../../public')));

// Network Configurations
const NETWORKS_CONFIG = {
  mainnet: {
    name: 'Celo Mainnet',
    chainId: 42220,
    networkWireName: 'celo',
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    explorer: 'https://celoscan.io',
    token: {
      address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
      symbol: 'USA₮',
      name: 'Tether USD',
      version: '1',
      decimals: 6
    }
  },
  sepolia: {
    name: 'Celo Sepolia Testnet',
    chainId: 11142220,
    networkWireName: 'celo-sepolia',
    rpcUrl: process.env.CELO_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org',
    explorer: 'https://sepolia.celoscan.io',
    token: {
      address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
      symbol: 'USDC',
      name: 'USDC',
      version: '2',
      decimals: 6
    }
  }
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// Helper to load Hackathon configuration
function getHackathonConfig() {
  try {
    const p = path.resolve(__dirname, '../../config/hackathon.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {}
  return {
    attributionTag: process.env.CELO_ATTRIBUTION_TAG || 'celo_ef9178addda4',
    agentId: '9797',
    agentWallet: process.env.AGENT_WALLET_ADDRESS || '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321'
  };
}

/**
 * GET /api/info
 * Public protocol, token contract addresses, and agent metadata
 */
app.get('/api/info', (req, res) => {
  const config = getHackathonConfig();
  res.json({
    name: 'Veridex',
    tagline: 'Autonomous Scam-Detection Gate for Stablecoin Transfers on Celo',
    agentId: config.agentId || '9797',
    agentWallet: config.agentWallet || '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321',
    attributionTag: config.attributionTag || 'celo_ef9178addda4',
    networks: NETWORKS_CONFIG,
    version: '1.0.0'
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/balance
 * Query token balance for connected wallet address
 */
app.get('/api/balance', async (req, res) => {
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

    res.json({
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
    console.error('Error fetching balance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/safesend/check
 * Run scam detection on message / URL / payment text
 */
app.post('/api/safesend/check', async (req, res) => {
  try {
    const { text, recipient, amount } = req.body;
    if (!text && !recipient) {
      return res.status(400).json({
        success: false,
        error: 'Missing input text or transfer details to evaluate.'
      });
    }

    const inputContent = text || `Transfer ${amount || '1.0'} to ${recipient}`;
    const scamReport = await ScamDetector.analyze(inputContent);

    // Auto-detect recipient / amount if not provided
    let resolvedRecipient = recipient || null;
    let resolvedAmount = amount || null;

    if (!resolvedRecipient && scamReport.extractedEntities.addresses.length > 0) {
      resolvedRecipient = scamReport.extractedEntities.addresses[0];
    }
    if (!resolvedAmount && scamReport.extractedEntities.amounts.length > 0) {
      resolvedAmount = scamReport.extractedEntities.amounts[0];
    }

    const isTransferRequest = Boolean(resolvedRecipient);
    const canProceed = scamReport.riskLevel !== 'HIGH' && isTransferRequest;

    return res.json({
      success: true,
      riskLevel: scamReport.riskLevel,
      score: scamReport.score,
      reasons: scamReport.reasons,
      speechExplanation: scamReport.speechExplanation,
      evaluatedBy: scamReport.evaluatedBy,
      extractedEntities: scamReport.extractedEntities,
      resolvedRecipient,
      resolvedAmount: resolvedAmount || '0.10',
      isTransferRequest,
      canProceed
    });
  } catch (error) {
    console.error('Error in /api/safesend/check:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while analyzing risk.'
    });
  }
});

/**
 * POST /api/safesend/execute
 * Settle client-signed (MetaMask) or testnet x402 payment
 */
app.post('/api/safesend/execute', async (req, res) => {
  try {
    const { 
      recipient, 
      amount, 
      network = 'mainnet', 
      signedPayload, 
      payer
    } = req.body;

    const config = getHackathonConfig();
    const attributionTag = config.attributionTag || 'celo_ef9178addda4';
    const dataSuffix = toDataSuffix(['veridex', attributionTag]);
    const netCfg = NETWORKS_CONFIG[network] || NETWORKS_CONFIG.mainnet;

    // Case 1: Client signed with MetaMask (Option A)
    if (signedPayload) {
      console.log(`\n[API Execute] Received MetaMask-signed authorization for ${netCfg.name}:`);
      console.log(`Payer: ${payer || signedPayload.paymentPayload?.payload?.authorization?.from}`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Amount: ${amount} ${netCfg.token.symbol}`);

      const x402Client = new X402FacilitatorClient(network === 'sepolia' ? 'sepolia' : 'mainnet');
      
      // Verify
      console.log(`Verifying payload with ${network} facilitator...`);
      const verifyRes = await x402Client.verifyPayment(signedPayload);
      if (!verifyRes.valid) {
        console.error('Facilitator verification failed:', verifyRes.data);
        return res.status(400).json({
          success: false,
          error: 'Facilitator verification failed: ' + (verifyRes.data?.invalidReasonDetails || verifyRes.data?.invalidReason || JSON.stringify(verifyRes.data)),
          details: verifyRes.data
        });
      }

      // Settle
      console.log(`Submitting settlement to ${network} facilitator...`);
      const settleRes = await x402Client.settlePayment(signedPayload);
      console.log('Facilitator Settle Response:', settleRes);

      const txHash = settleRes.transaction || settleRes.txHash;

      return res.json({
        success: true,
        network: netCfg.networkWireName,
        txHash,
        explorerUrl: `${netCfg.explorer}/tx/${txHash}`,
        payer: settleRes.payer || payer,
        recipient,
        amount,
        token: netCfg.token.symbol,
        attributionTag,
        dataSuffix,
        facilitator: network === 'sepolia' ? 'https://api.x402.sepolia.celo.org' : 'https://api.x402.celo.org'
      });
    }

    // Case 2: Backend-executed testnet rehearsal with test user wallet
    if (network === 'sepolia') {
      const userConfigPath = path.resolve(__dirname, '../../config/test_user.json');
      if (!fs.existsSync(userConfigPath)) {
        throw new Error('Test user wallet not configured. Run scripts/get_test_user_wallet.js');
      }
      const userData = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
      const userWallet = new ethers.Wallet(userData.privateKey);

      const tokenAddress = netCfg.token.address;
      const parsedAmount = ethers.parseUnits(amount.toString(), netCfg.token.decimals).toString();
      const validBefore = Math.floor(Date.now() / 1000) + 3600;
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      const domain = {
        name: netCfg.token.name,
        version: netCfg.token.version,
        chainId: netCfg.chainId,
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

      const authMessage = {
        from: userWallet.address,
        to: recipient,
        value: parsedAmount,
        validAfter: 0,
        validBefore,
        nonce
      };

      const signature = await userWallet.signTypedData(domain, types, authMessage);

      const wirePayload = X402FacilitatorClient.buildV1Request({
        networkName: netCfg.networkWireName,
        tokenAddress,
        payerAddress: userWallet.address,
        recipientAddress: recipient,
        amount: parsedAmount,
        validBefore,
        nonce,
        signature,
        description: `Veridex Transfer [tag:${attributionTag}]`
      });

      const x402Client = new X402FacilitatorClient('sepolia');
      const verifyRes = await x402Client.verifyPayment(wirePayload);
      if (!verifyRes.valid) {
        return res.status(400).json({
          success: false,
          error: 'Facilitator verification failed',
          details: verifyRes.data
        });
      }

      const settleRes = await x402Client.settlePayment(wirePayload);

      return res.json({
        success: true,
        network: 'celo-sepolia',
        txHash: settleRes.transaction,
        explorerUrl: `https://sepolia.celoscan.io/tx/${settleRes.transaction}`,
        payer: settleRes.payer,
        recipient,
        amount,
        token: netCfg.token.symbol,
        attributionTag,
        dataSuffix,
        facilitator: 'https://api.x402.sepolia.celo.org'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Direct mainnet execution requires client-side MetaMask signature. Please connect MetaMask to sign.'
    });

  } catch (error) {
    console.error('Error in /api/safesend/execute:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Transfer execution failed.'
    });
  }
});

module.exports = app;
