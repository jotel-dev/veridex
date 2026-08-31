/**
 * Test x402 topup and Celo Sepolia faucet
 */

const { ethers } = require('ethers');

async function testTopup() {
  const addr = '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321';
  try {
    const res = await fetch(`https://x402.celo.org/api/topup/${addr}`);
    console.log('x402 Topup status:', res.status, await res.text());
  } catch (e) {
    console.log('x402 Topup error:', e.message);
  }

  // Check Celo faucet endpoint (faucet.celo.org or cloudflare faucet)
  const faucetUrls = [
    'https://faucet.celo.org/api/sepolia',
    'https://faucet.celo.org/api/faucet',
    'https://celo.org/api/faucet'
  ];

  for (const url of faucetUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr })
      });
      console.log(`Faucet [${url}] status:`, res.status, await res.text());
    } catch (e) {
      console.log(`Faucet [${url}] error:`, e.message);
    }
  }
}

testTopup();
