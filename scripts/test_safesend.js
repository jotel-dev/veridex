/**
 * Test Suite for Veridex SafeSend Pipeline
 * 
 * Runs end-to-end test cases covering:
 * - Phishing / Scam detection & Gatekeeper blocking
 * - Lookalike domain and urgency detection
 * - Legitimate transfer simulation with gas sponsorship
 * - Attribution tag (ERC-8021) suffix verification
 */

const { SafeSendPipeline, ScamDetector, TransferService } = require('../src/safesend');
const { fromDataSuffix } = require('@celo/attribution-tags');
const assert = require('assert');

async function runTests() {
  console.log('====================================================');
  console.log('  🧪 RUNNING VERIDEX SAFESEND TEST SUITE            ');
  console.log('====================================================\n');

  const pipeline = new SafeSendPipeline();
  let passedCount = 0;
  let totalCount = 0;

  function recordResult(name, success, details = '') {
    totalCount++;
    if (success) {
      passedCount++;
      console.log(`✅ [PASS] ${name} ${details}`);
    } else {
      console.error(`❌ [FAIL] ${name} ${details}`);
    }
  }

  // --- TEST CASE 1: High-Risk Seed Phrase Phishing ---
  console.log('\n--- TEST CASE 1: Phishing Credential Theft ---');
  const phishingInput = "URGENT! Your Celo account will be suspended within 24 hours. Enter your 12 recovery words to verify your wallet.";
  const result1 = await pipeline.process(phishingInput, { recipient: '0x140B5C92Ca568D3DB4ED1FfFBFdFd8a1C399Da8E', amount: '100' });
  
  recordResult(
    'Phishing with Seed Phrase Blocked',
    result1.status === 'BLOCKED' && result1.scamCheck.riskLevel === 'HIGH' && result1.transfer.executed === false,
    `Score: ${result1.scamCheck.score}/100, Matched: ${result1.scamCheck.matchedRules.join(', ')}`
  );
  assert(result1.scamCheck.speechExplanation.length > 0, 'Must include speech explanation');

  // --- TEST CASE 2: Suspicious Lookalike Domain & TLD ---
  console.log('\n--- TEST CASE 2: Lookalike Domain with Dangerous TLD ---');
  const lookalikeInput = "Claim your exclusive 5000 USDT reward here: https://c3lo-airdrop-reward.zip/claim";
  const result2 = await pipeline.process(lookalikeInput);

  recordResult(
    'Lookalike Domain & Dangerous TLD Blocked',
    result2.status === 'BLOCKED' && result2.scamCheck.riskLevel === 'HIGH',
    `Score: ${result2.scamCheck.score}/100, Matched: ${result2.scamCheck.matchedRules.join(', ')}`
  );

  // --- TEST CASE 3: URL Shortener with Urgency Coercion ---
  console.log('\n--- TEST CASE 3: URL Shortener with Urgency Coercion ---');
  const shortenerInput = "Act now! Limited time giveaway. Double your deposit: https://bit.ly/celo-bonus-airdrop";
  const result3 = await pipeline.process(shortenerInput);

  recordResult(
    'URL Shortener + Fake Reward Blocked',
    result3.status === 'BLOCKED' && result3.scamCheck.riskLevel === 'HIGH',
    `Score: ${result3.scamCheck.score}/100`
  );

  // --- TEST CASE 4: Clean Transfer Request (SafeSend Cleared) ---
  console.log('\n--- TEST CASE 4: Legitimate Transfer Request ---');
  const cleanInput = {
    message: "Monthly team coffee fund payment on Celo",
    recipient: "0x140B5C92Ca568D3DB4ED1FfFBFdFd8a1C399Da8E",
    amount: "10.0",
    simulateOnly: true
  };

  const result4 = await pipeline.process(cleanInput);

  recordResult(
    'Clean Transfer Request Passed Security Gate',
    result4.status === 'SIMULATED' && result4.scamCheck.riskLevel === 'LOW' && result4.blocked === false,
    `Risk: ${result4.scamCheck.riskLevel}, Token: ${result4.transfer.token}`
  );

  // --- TEST CASE 5: Attribution Tag & Suffix Integrity ---
  console.log('\n--- TEST CASE 5: ERC-8021 Attribution Data Suffix ---');
  const transferService = new TransferService();
  const suffix = transferService.getAttributionDataSuffix();
  
  const decoded = fromDataSuffix(suffix);
  const codes = decoded.codes || [];
  recordResult(
    'Attribution Tag Decodes Correctly via SDK',
    codes.includes('veridex') && codes.includes('celo_ef9178addda4'),
    `Decoded Tags: [${codes.join(', ')}] with ERC-8021 schemaId ${decoded.schemaId}`
  );

  // Summary
  console.log('\n====================================================');
  console.log(`  RESULTS: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
