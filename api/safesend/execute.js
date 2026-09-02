/**
 * Vercel Serverless Function: POST /api/safesend/execute
 * 
 * Settle client-signed (MetaMask) or testnet transfer:
 * - Mainnet USA₮: Direct EIP-3009 relay (fallback — Celo's hosted x402 facilitator currently fails preflight on Tether's missing version() method)
 * - Sepolia / Mainnet USDC: x402 Facilitator (EIP-3009)
 * 
 * Safety Features:
 * - Max Transfer Cap ($50.00 max limit)
 * - Sliding-window IP & Payer Rate Limiting (max 5 tx/min)
 * - Payload & authorization amount integrity validation
 */

const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { X402FacilitatorClient } = require('../../src/safesend/x402Client');
const { TransferService } = require('../../src/safesend/transferService');
const { toDataSuffix } = require('@celo/attribution-tags');

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
  // Filter out timestamps outside the active sliding window
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { 
      recipient, 
      amount, 
      network = 'mainnet', 
      signedPayload, 
      payer
    } = req.body || {};

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

    // Case 1: Client signed with MetaMask
    if (signedPayload) {
      const auth = signedPayload.paymentPayload?.payload?.authorization;
      const signature = signedPayload.paymentPayload?.payload?.signature;
      const payerAddr = payer || auth?.from;

      if (!auth || !signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing authorization parameters or cryptographic signature in payload.'
        });
      }

      // Verify payload value matches amount
      const expectedRawValue = ethers.parseUnits(amount.toString(), netCfg.token.decimals).toString();
      if (auth.value.toString() !== expectedRawValue) {
        return res.status(400).json({
          success: false,
          error: `Amount mismatch: payload value (${auth.value}) does not match requested amount (${expectedRawValue}).`
        });
      }

      console.log(`\n[API Execute] Received MetaMask-signed authorization for ${netCfg.name}:`);
      console.log(`Payer: ${payerAddr}`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Amount: ${amount} ${netCfg.token.symbol}`);

      // Path A: Celo Mainnet USA₮ -> Direct EIP-3009 relay fallback
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

        return res.status(200).json({
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

      return res.status(200).json({
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
      const parsedRawAmount = ethers.parseUnits(amount.toString(), netCfg.token.decimals).toString();
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
        value: parsedRawAmount,
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
        amount: parsedRawAmount,
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

      return res.status(200).json({
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
};
