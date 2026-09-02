/**
 * Vercel Serverless Function: /api/safesend/check
 * Supports:
 * - GET: Health check & API documentation
 * - POST: Scam detection and risk evaluation
 * - OPTIONS: CORS preflight
 */

const { ScamDetector } = require('../../src/safesend/scamDetector');

module.exports = async function handler(req, res) {
  // Set permissive CORS headers for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request for direct browser verification
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      endpoint: '/api/safesend/check',
      service: 'Veridex SafeSend Scam Detector API',
      description: 'Autonomous Scam-Detection Gate for Stablecoin Transfers on Celo',
      methods: ['GET', 'POST'],
      usage: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          text: 'Transfer 0.10 USA₮ to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          amount: '0.10'
        }
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST to submit data.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.warn('Failed to parse body as JSON string:', e);
      }
    }

    const { text, recipient, amount } = body || {};
    if (!text && !recipient) {
      return res.status(400).json({
        success: false,
        error: 'Missing input text or transfer details to evaluate.'
      });
    }

    const inputContent = text || `Transfer ${amount || '0.10'} to ${recipient}`;
    const scamReport = await ScamDetector.analyze(inputContent);

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

    return res.status(200).json({
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
};
