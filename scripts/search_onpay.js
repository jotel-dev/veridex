/**
 * Search bundle for the exact onPay / payment signing function
 */

async function searchOnPay() {
  const url = 'https://x402.celo.org/assets/index-7TQsUzcD.js';
  const res = await fetch(url);
  const text = await res.text();

  const idx = text.indexOf('transferWithAuthorization');
  const idxs = [];
  let pos = 0;
  while ((pos = text.indexOf('onPay', pos)) !== -1) {
    idxs.push(pos);
    pos += 5;
  }

  for (const i of idxs) {
    console.log('--- onPay context ---');
    console.log(text.slice(Math.max(0, i - 200), Math.min(text.length, i + 800)));
  }
}

searchOnPay().catch(console.error);
