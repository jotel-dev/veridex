/**
 * Search bundle for /settle and /verify
 */

async function searchBundle() {
  const url = 'https://x402.celo.org/assets/index-7TQsUzcD.js';
  const res = await fetch(url);
  const text = await res.text();

  const keywords = ['settle', 'verify', 'paymentPayload', 'paymentRequirements', 'authorization', 'transferWithAuthorization'];
  for (const kw of keywords) {
    let pos = 0;
    const matches = [];
    while ((pos = text.indexOf(kw, pos)) !== -1 && matches.length < 3) {
      matches.push(text.slice(Math.max(0, pos - 150), Math.min(text.length, pos + 250)));
      pos += kw.length;
    }
    console.log(`\n=== KEYWORD: ${kw} (${matches.length} matches) ===`);
    for (const m of matches) {
      console.log('--- snippet ---');
      console.log(m);
    }
  }
}

searchBundle().catch(console.error);
