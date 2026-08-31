/**
 * Veridex SafeSend Module Index
 */

const { ScamDetector, RULES, HIGH_RISK_TLDS, URL_SHORTENERS, LOOKALIKE_PATTERNS } = require('./scamDetector');
const { TransferService, TOKENS } = require('./transferService');
const { X402FacilitatorClient, X402_ENDPOINTS } = require('./x402Client');
const { SafeSendPipeline } = require('./safeSendPipeline');

module.exports = {
  ScamDetector,
  TransferService,
  X402FacilitatorClient,
  SafeSendPipeline,
  TOKENS,
  RULES,
  HIGH_RISK_TLDS,
  URL_SHORTENERS,
  LOOKALIKE_PATTERNS
};
