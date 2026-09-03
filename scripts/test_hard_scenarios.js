/**
 * Test the 3 hard stealth stress-test scenarios
 */

require('dotenv').config();
const { ScamDetector } = require('../src/safesend/scamDetector');

const HARD_SCENARIOS = [
  {
    id: 'a',
    title: 'a) Calm Professional Approval Phishing (No Urgency)',
    text: 'Hi, thanks for your patience. To finalize your allocation, please approve spending access at the contract below so we can process your reward: 0x140B5C92Ca568D3DB4ED1FfFBFdFd8a1C399Da8E'
  },
  {
    id: 'b',
    title: 'b) Lookalike Domain with Character Substitution (1 for l, authentic .org TLD)',
    text: 'Please verify your account at ce1o-rewards.org'
  },
  {
    id: 'c',
    title: 'c) Calm Support Social Engineering (No Link, No Urgency, No Reward)',
    text: 'Hi, this is Sarah from Celo support. We noticed unusual activity — can you confirm your wallet address so we can verify your account?'
  }
];

async function run() {
  console.log('================================================================');
  console.log('  RUNNING 3 ADVANCED / HARD STEALTH STRESS TESTS');
  console.log('================================================================\n');

  for (const s of HARD_SCENARIOS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Scenario: ${s.title}`);
    console.log(`Input: "${s.text}"`);
    console.log(`----------------------------------------------------------------`);

    const res = await ScamDetector.analyze(s.text);
    console.log(`Verdict: [${res.riskLevel}] (Score: ${res.score}/100)`);
    console.log(`Evaluated By: ${res.evaluatedBy}`);
    console.log(`Reasons:`, res.reasons);
    console.log(`Recommendation:`, res.recommendation);
  }
}

run().catch(console.error);
