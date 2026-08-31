/**
 * Test settle endpoint with X-API-Key and payment payload
 */

require('dotenv').config();

async function testSettle() {
  const apiKey = process.env.X402_API_KEY;
  console.log('Using API key:', apiKey);

  // Test settle on mainnet and sepolia
  const urls = [
    'https://api.x402.celo.org/settle',
    'https://api.x402.sepolia.celo.org/settle'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          payment: 'test-payload',
          network: url.includes('sepolia') ? 'celo-sepolia' : 'celo'
        })
      });
      console.log(`[${url}] Status: ${res.status}`);
      console.log('Response:', await res.text());
    } catch (e) {
      console.log(`[${url}] Error:`, e.message);
    }
  }
}

testSettle().catch(console.error);
