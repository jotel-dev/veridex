/**
 * Veridex - REST API & Web Application Server
 * 
 * Exposes the Veridex security & transfer pipeline as a clean REST API
 * supporting interactive client-side MetaMask EIP-3009 signing, x402 settlement (USDC),
 * and Direct EIP-3009 relay (fallback — Celo's hosted x402 facilitator currently fails preflight on Tether's missing version() method).
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
 * GET /api/safesend/check
 * Endpoint status and usage instructions
 */
app.get('/api/safesend/check', (req, res) => {
  res.json({
    status: 'ok',
    endpoint: '/api/safesend/check',
    service: 'Veridex SafeSend Scam Detector API',
    description: 'Autonomous Scam-Detection Gate for Stablecoin Transfers on Celo',
    methods: ['GET', 'POST'],
    usage: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        text: 'Transfer 0.10 USA₮ to 0x092ADf3A513C2d993D8DCa745FD9BC64843B9707',
        recipient: '0x092ADf3A513C2d993D8DCa745FD9BC64843B9707',
        amount: '0.10'
      }
    }
  });
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

    const inputContent = text || `Transfer ${amount || '0.10'} to ${recipient}`;
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

// Safety Constants
const MAX_TRANSFER_CAP = parseFloat(process.env.MAX_TRANSFER_CAP || '50.0'); // $50.00 USD Max Cap
const MIN_TRANSFER_AMOUNT = 0.0001;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 transfer executions per minute

// In-Memory Rate Limiting Tracker (Sliding Window)
const rateLimitMap = new Map();

function checkRateLimit(identifier) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  
  let timestamps = rateLimitMap.get(identifier) || [];
  timestamps = timestamps.filter(ts => ts > windowStart);
  
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec, remaining: 0 };
  }
  
  timestamps.push(now);
  rateLimitMap.set(identifier, timestamps);
  return { allowed: true, retryAfterSec: 0, remaining: MAX_REQUESTS_PER_WINDOW - timestamps.length };
}

/**
 * GET /api/safesend/execute
 * Endpoint status and usage instructions
 */
app.get('/api/safesend/execute', (req, res) => {
  res.json({
    status: 'ok',
    endpoint: '/api/safesend/execute',
    service: 'Veridex SafeSend Transfer Execution API',
    description: 'Executes gasless EIP-3009 transfers over Direct Relay or x402 Facilitator on Celo',
    methods: ['GET', 'POST']
  });
});

/**
 * POST /api/safesend/execute
 * Settle client-signed (MetaMask) or testnet transfer
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

    // -------------------------------------------------------------
    // SAFETY CHECK 1: RATE LIMITING (Sliding Window per IP / Payer)
    // -------------------------------------------------------------
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const rateLimitKey = payer ? `${payer.toLowerCase()}_${clientIp}` : clientIp;
    const rateLimit = checkRateLimit(rateLimitKey);

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', rateLimit.retryAfterSec.toString());
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Too many transfer requests. Please wait ${rateLimit.retryAfterSec}s before retrying.`,
        retryAfter: rateLimit.retryAfterSec
      });
    }

    // -------------------------------------------------------------
    // SAFETY CHECK 2: MAX TRANSFER CAP & AMOUNT VALIDATION
    // -------------------------------------------------------------
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < MIN_TRANSFER_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Invalid transfer amount: ${amount}. Minimum amount is ${MIN_TRANSFER_AMOUNT}.`
      });
    }

    if (parsedAmount > MAX_TRANSFER_CAP) {
      return res.status(400).json({
        success: false,
        error: `Transfer amount ($${parsedAmount.toFixed(2)}) exceeds maximum safety cap ($${MAX_TRANSFER_CAP.toFixed(2)}).`,
        maxTransferCap: MAX_TRANSFER_CAP
      });
    }

    // Recipient address format check
    if (!recipient || !ethers.isAddress(recipient.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid or missing recipient EVM address: ${recipient}`
      });
    }

    const config = getHackathonConfig();
    const attributionTag = config.attributionTag || 'celo_ef9178addda4';
    const dataSuffix = toDataSuffix(['veridex', attributionTag]);
    const netCfg = NETWORKS_CONFIG[network] || NETWORKS_CONFIG.mainnet;

    // Case 1: Client signed with MetaMask (Option A)
    if (signedPayload) {
      const auth = signedPayload.paymentPayload?.payload?.authorization;
      const signature = signedPayload.paymentPayload?.payload?.signature;
      const payerAddr = payer || auth?.from;

      console.log(`\n[API Execute] Received MetaMask-signed authorization for ${netCfg.name}:`);
      console.log(`Payer: ${payerAddr}`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Amount: ${amount} ${netCfg.token.symbol}`);

      // Path A: Celo Mainnet USA₮ -> Direct EIP-3009 relay fallback
      // (Fallback because Celo's hosted x402 facilitator currently fails preflight on Tether's missing version() method)
      if (network === 'mainnet') {
        const transferService = new TransferService({
          tokenAddress: netCfg.token.address,
          tokenDecimals: netCfg.token.decimals,
          tokenSymbol: netCfg.token.symbol,
          attributionTag
        });

        const relayRes = await transferService.relayEIP3009Authorization({
          from: payerAddr,
          to: recipient,
          value: auth.value,
          validAfter: parseInt(auth.validAfter || '0', 10),
          validBefore: parseInt(auth.validBefore, 10),
          nonce: auth.nonce,
          signature,
          tokenAddress: netCfg.token.address
        });

        return res.json({
          success: true,
          network: 'celo-mainnet',
          txHash: relayRes.txHash,
          explorerUrl: relayRes.explorerUrl,
          payer: relayRes.payer,
          recipient: relayRes.recipient,
          amount,
          token: netCfg.token.symbol,
          attributionTag,
          dataSuffix,
          rail: "Direct EIP-3009 relay (fallback — Celo's hosted x402 facilitator currently fails preflight on Tether's missing version() method)",
          sponsorWallet: relayRes.sponsorWallet
        });
      }

      // Path B: USDC over hosted x402 Facilitator (Celo Sepolia or Mainnet USDC)
      const x402Client = new X402FacilitatorClient(network === 'sepolia' ? 'sepolia' : 'mainnet');
      console.log(`Verifying payload with ${network} x402 facilitator...`);
      const verifyRes = await x402Client.verifyPayment(signedPayload);
      if (!verifyRes.valid) {
        console.error('x402 Facilitator verification failed:', verifyRes.data);
        return res.status(400).json({
          success: false,
          error: 'Facilitator verification failed: ' + (verifyRes.data?.invalidReasonDetails || verifyRes.data?.invalidReason || JSON.stringify(verifyRes.data)),
          details: verifyRes.data
        });
      }

      console.log(`Submitting settlement to ${network} x402 facilitator...`);
      const settleRes = await x402Client.settlePayment(signedPayload);
      const txHash = settleRes.transaction || settleRes.txHash;

      return res.json({
        success: true,
        network: netCfg.networkWireName,
        txHash,
        explorerUrl: `${netCfg.explorer}/tx/${txHash}`,
        payer: settleRes.payer || payerAddr,
        recipient,
        amount,
        token: netCfg.token.symbol,
        attributionTag,
        dataSuffix,
        rail: 'x402 Facilitator (EIP-3009)',
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
        rail: 'x402 Facilitator (EIP-3009)',
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
