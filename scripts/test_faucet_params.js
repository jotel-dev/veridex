/**
 * Test Celo Faucet endpoints
 */

async function testFaucet() {
  const addr = '0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321';
  const tokens = ['CELO', 'USDC', 'cUSD'];
  const networks = ['celo-sepolia', 'sepolia'];

  for (const n of networks) {
    for (const tok of tokens) {
      try {
        const res = await fetch('https://faucet.celo.org/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addr, network: n, token: tok })
        });
        console.log(`[${n} - ${tok}] status: ${res.status}`, await res.text());
      } catch (e) {
        console.log(`[${n} - ${tok}] error:`, e.message);
      }
    }
  }
}

testFaucet().catch(console.error);
