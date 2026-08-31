/**
 * Veridex - REST API & Web Application Server
 * 
 * Exposes the Veridex security & transfer pipeline as a clean REST API
 * for web clients, MiniPay-adjacent frontends, and bots.
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
 * Public protocol & agent identity metadata
 */
app.get('/api/info', (req, res) => {
  const config = getHackathonConfig();
  res.json({
    name: 'Veridex',
    tagline: 'Autonomous Scam-Detection Gate for Stablecoin Transfers on Celo',
    agentId: config.agentId || '9797',
    agentWallet: config.agentWallet || '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321',
    attributionTag: config.attributionTag || 'celo_ef9178addda4',
    network: 'celo-sepolia',
    chainId: 11142220,
    mainnetReady: true,
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
      resolvedAmount: resolvedAmount || '1.00',
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
 * Execute the transfer / x402 settlement on-chain
 */
app.post('/api/safesend/execute', async (req, res) => {
  try {
    const { recipient, amount = '1.00', network = 'sepolia', simulateOnly = false } = req.body;

    if (!recipient || !ethers.isAddress(recipient)) {
      return res.status(400).json({
        success: false,
        error: `Invalid or missing recipient EVM address: ${recipient}`
      });
    }

    const config = getHackathonConfig();
    const attributionTag = config.attributionTag || 'celo_ef9178addda4';
    const dataSuffix = toDataSuffix(['veridex', attributionTag]);

    // Testnet execution via x402 facilitator with isolated test user wallet
    if (network === 'sepolia') {
      const userConfigPath = path.resolve(__dirname, '../../config/test_user.json');
      if (!fs.existsSync(userConfigPath)) {
        throw new Error('Test user wallet not configured. Run scripts/get_test_user_wallet.js');
      }
      const userData = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
      const userWallet = new ethers.Wallet(userData.privateKey);

      const tokenAddress = '0x01C5C0122039549AD1493B8220cABEdD739BC44E'; // Celo Sepolia USDC
      const parsedAmount = ethers.parseUnits(amount.toString(), 6).toString();
      const validBefore = Math.floor(Date.now() / 1000) + 3600;
      const nonce = ethers.hexlify(ethers.randomBytes(32));

      // Sign EIP-3009 TransferWithAuthorization
      const domain = {
        name: 'USDC',
        version: '2',
        chainId: 11142220,
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

      // Build wire request
      const wirePayload = X402FacilitatorClient.buildV1Request({
        networkName: 'celo-sepolia',
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
          error: 'Facilitator payment verification failed',
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
        token: 'USDC',
        attributionTag,
        dataSuffix,
        facilitator: 'https://api.x402.sepolia.celo.org'
      });
    }

    // Mainnet or simulated execution
    const transferService = new TransferService();
    const transferResult = await transferService.executeSponsoredTransfer({
      recipient,
      amount,
      simulateOnly
    });

    return res.json({
      success: true,
      network: 'celo',
      ...transferResult,
      explorerUrl: transferResult.txHash ? `https://celoscan.io/tx/${transferResult.txHash}` : null,
      attributionTag,
      dataSuffix
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
