/**
 * Test 5 Stress-Test Scenarios with Gemini LLM Fallback / Rule Engine
 */

const { ScamDetector } = require('../src/safesend/scamDetector');

const SCENARIOS = [
  {
    name: '1. Approval Phishing',
    input: 'URGENT: Your Celo wallet requires security permit authorization! Click here to sign and approve unlimited spend to sweep and claim all assets immediately.'
  },
  {
    name: '2. Lookalike Domain',
    input: 'Congratulations! Claim your 5,000 cUSD allocation on the new Celo protocol portal: https://c3lo-airdrop-reward.zip/claim before it expires.'
  },
  {
    name: '3. Clean Lunch Message',
    input: 'Hey Alice, splitting the bill for lunch yesterday. Sending 15 USA₮ to 0x092ADf3A513C2d993D8DCa745FD9BC64843B9707 for the sushi.'
  },
  {
    name: '4. No-Link Social Engineering Request',
    input: "Hey bro, emergency situation! My bank account is frozen and I'm stranded at the transit station. Can you please send 45 USA₮ right now to 0x092ADf3A513C2d993D8DCa745FD9BC64843B9707? I will pay you back double tomorrow morning."
  },
  {
    name: '5. Address Poisoning / Zero Address',
    input: 'Transfer 10 USA₮ to 0x0000000000000000000000000000000000000000'
  }
];

async function runTests() {
  console.log('===========================================================');
  console.log('  VERIDEX SAFESEND - 5 STRESS TEST SCENARIOS');
  console.log('  Gemini API Key configured:', Boolean(process.env.GEMINI_API_KEY));
  console.log('===========================================================\n');

  const results = [];

  for (const s of SCENARIOS) {
    console.log(`\n--- Running Scenario: ${s.name} ---`);
    console.log(`Input: "${s.input}"`);

    const report = await ScamDetector.analyze(s.input);

    console.log(`Verdict: [${report.riskLevel}] (Score: ${report.score}/100)`);
    console.log(`Evaluated By: ${report.evaluatedBy}`);
    console.log(`Reasons:`, report.reasons);
    console.log(`Recommendation:`, report.recommendation);
    console.log(`TTS Voice Warning:`, report.speechExplanation);

    results.push({
      scenario: s.name,
      riskLevel: report.riskLevel,
      score: report.score,
      evaluatedBy: report.evaluatedBy,
      reasons: report.reasons,
      recommendation: report.recommendation
    });
  }

  console.log('\n===========================================================');
  console.log('  SUMMARY OF STRESS TEST VERDICTS');
  console.log('===========================================================');
  results.forEach(r => {
    console.log(`${r.scenario}: [${r.riskLevel}] (Score: ${r.score}/100) via ${r.evaluatedBy}`);
  });
}

runTests().catch(console.error);
