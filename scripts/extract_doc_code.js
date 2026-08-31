/**
 * Extract documentation code sample from x402 dashboard bundle
 */

async function extractDocCode() {
  const url = 'https://x402.celo.org/assets/index-7TQsUzcD.js';
  const res = await fetch(url);
  const text = await res.text();

  const keywords = ['curl', 'Authorization: Bearer', 'PAYMENT-SIGNATURE', 'PAYMENT', 'X-API-KEY', 'api.x402.celo.org'];
  for (const kw of keywords) {
    let pos = 0;
    while ((pos = text.indexOf(kw, pos)) !== -1) {
      console.log(`\n=== MATCH FOR: ${kw} ===`);
      console.log(text.slice(Math.max(0, pos - 150), Math.min(text.length, pos + 450)));
      pos += kw.length + 100;
    }
  }
}

extractDocCode().catch(console.error);
