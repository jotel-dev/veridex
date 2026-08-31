/**
 * Find definition of R in zE component
 */

async function findR() {
  const url = 'https://x402.celo.org/assets/index-7TQsUzcD.js';
  const res = await fetch(url);
  const text = await res.text();

  const idx = text.indexOf('onPay:R');
  if (idx !== -1) {
    console.log('--- zE component context ---');
    console.log(text.slice(Math.max(0, idx - 1500), Math.min(text.length, idx + 200)));
  }
}

findR().catch(console.error);
