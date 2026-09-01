/**
 * Vercel Serverless Function: POST /api/safesend/check
 */

const { ScamDetector } = require('../../src/safesend/scamDetector');

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
    const { text, recipient, amount } = req.body || {};
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
