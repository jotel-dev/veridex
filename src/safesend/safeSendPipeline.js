/**
 * Veridex SafeSend - Core Security & Transfer Pipeline
 * 
 * Flow:
 * 1. Intake: text, URL, forwarded chat message, or transfer intent
 * 2. Scam Check: Heuristic scanner + Claude LLM fallback
 * 3. Gatekeeper:
 *    - HIGH RISK -> Block flow, return speech alert, stop execution.
 *    - LOW/MEDIUM -> Proceed to gas-sponsored USA₮ transfer over x402 with attribution tag.
 * 4. Structured Output
 */

const { ScamDetector } = require('./scamDetector');
const { TransferService } = require('./transferService');
const { ethers } = require('ethers');

class SafeSendPipeline {
  /**
   * @param {object} [options]
   * @param {string} [options.tokenAddress]
   * @param {string} [options.attributionTag]
   */
  constructor(options = {}) {
    this.transferService = new TransferService(options);
  }

  /**
   * Execute the SafeSend pipeline
   * @param {object|string} input - Input text/message or structured transfer request
   * @param {object} [transferParams] - Optional explicit transfer details { recipient, amount, simulateOnly }
   * @returns {Promise<object>}
   */
  async process(input, transferParams = {}) {
    console.log('\n====================================================');
    console.log('  🛡️  VERIDEX SAFESEND PIPELINE INITIATED           ');
    console.log('====================================================');

    const inputText = typeof input === 'string' ? input : (input.text || input.message || JSON.stringify(input));
    
    // Step 1: Execute scam & fraud detection
    console.log('\n[Step 1] Running Multi-Layer Scam Detection Check...');
    const scamReport = await ScamDetector.analyze(inputText);
    
    console.log(`[Step 1] Verdict: [${scamReport.riskLevel}] (Risk Score: ${scamReport.score}/100)`);
    console.log(`[Step 1] Evaluated By: ${scamReport.evaluatedBy}`);
    for (const r of scamReport.reasons) {
      console.log(`   • ${r}`);
    }

    // Step 2: High Risk Security Gate
    if (scamReport.riskLevel === 'HIGH') {
      console.log('\n🚫 [Step 2] HIGH RISK DETECTED: SAFESEND GATE ACTIVATED');
      console.log('🚫 Transfer BLOCKED to protect user funds.');
      console.log(`🗣️ TTS Audio Notice: "${scamReport.speechExplanation}"`);

      return {
        status: 'BLOCKED',
        success: false,
        blocked: true,
        reason: 'Blocked by Veridex SafeSend security gate due to high fraud risk.',
        scamCheck: scamReport,
        transfer: {
          executed: false,
          reason: 'Transfer prohibited due to security risks.'
        }
      };
    }

    // Step 3: Low/Medium Risk - Proceed to transfer
    console.log('\n✅ [Step 2] Security Gate Cleared. Proceeding to Transfer Pipeline...');

    // Extract or resolve transfer parameters
    let recipient = transferParams.recipient || (typeof input === 'object' ? input.recipient : null);
    let amount = transferParams.amount || (typeof input === 'object' ? input.amount : null);
    const simulateOnly = transferParams.simulateOnly || (typeof input === 'object' ? input.simulateOnly : false);

    // Auto-extract from text if not provided explicitly
    if (!recipient && scamReport.extractedEntities.addresses.length > 0) {
      recipient = scamReport.extractedEntities.addresses[0];
    }
    if (!amount && scamReport.extractedEntities.amounts.length > 0) {
      amount = scamReport.extractedEntities.amounts[0];
    }

    // If no recipient/amount given (e.g. user just forwarded a link/message for check only)
    if (!recipient || !amount) {
      console.log('ℹ️ No recipient or amount provided; scam analysis complete without transfer.');
      return {
        status: 'ANALYZED_ONLY',
        success: true,
        blocked: false,
        scamCheck: scamReport,
        transfer: {
          executed: false,
          note: 'No transfer parameters provided.'
        }
      };
    }

    // Step 4: Execute Sponsored USA₮ Transfer
    console.log('\n[Step 3] Executing Sponsored USA₮ Transfer on Celo...');
    try {
      const transferResult = await this.transferService.executeSponsoredTransfer({
        recipient,
        amount,
        simulateOnly
      });

      console.log('\n====================================================');
      console.log(`  🎉 SAFESEND TRANSFER ${simulateOnly ? 'SIMULATED' : 'COMPLETED'}!`);
      console.log('====================================================');

      return {
        status: simulateOnly ? 'SIMULATED' : 'COMPLETED',
        success: true,
        blocked: false,
        scamCheck: scamReport,
        transfer: {
          executed: !simulateOnly,
          simulated: simulateOnly,
          ...transferResult,
          sponsoredGas: true
        }
      };
    } catch (err) {
      console.error('\n❌ Transfer execution error:', err.message);
      return {
        status: 'TRANSFER_FAILED',
        success: false,
        blocked: false,
        scamCheck: scamReport,
        transfer: {
          executed: false,
          error: err.message
        }
      };
    }
  }
}

module.exports = {
  SafeSendPipeline
};
