/**
 * Issue real x402 API key from x402.celo.org using Agent Wallet Signature
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function getX402ApiKey() {
  console.log('====================================================');
  console.log('  GENERATING REAL X402 API KEY VIA WALLET SIGNATURE ');
  console.log('====================================================\n');

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY not found in .env');
  }

  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;
  console.log(`[1] Agent Wallet Address: ${address}`);

  // 1. Fetch nonce from x402.celo.org
  console.log('[2] Requesting nonce from https://x402.celo.org/api/keys/nonce...');
  const nonceRes = await fetch('https://x402.celo.org/api/keys/nonce');
  if (!nonceRes.ok) {
    throw new Error(`Failed to fetch nonce (${nonceRes.status}): ${await nonceRes.text()}`);
  }
  const { nonce } = await nonceRes.json();
  console.log(`[2] Nonce received: ${nonce}`);

  // 2. Format exact authentication message
  const authDomain = 'x402.celo.org';
  const message = `${authDomain} wants you to create an x402 API key.\n\nAddress: ${address}\nNonce: ${nonce}\n\nSigning this message proves you control this wallet. It costs no gas and sends no transaction.`;

  console.log('\n[3] Message to sign:');
  console.log('----------------------------------------');
  console.log(message);
  console.log('----------------------------------------');

  // 3. Sign message off-chain with Agent Wallet
  const signature = await wallet.signMessage(message);
  console.log(`[4] Signature created: ${signature.slice(0, 30)}...`);

  // 4. Submit to https://x402.celo.org/api/keys
  console.log('[5] Submitting signature to https://x402.celo.org/api/keys...');
  const keysRes = await fetch('https://x402.celo.org/api/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address,
      nonce,
      signature
    })
  });

  const keysData = await keysRes.json();
  if (!keysRes.ok || !keysData.apiKey) {
    console.error('Keys API error response:', keysData);
    throw new Error(`Failed to get API key (${keysRes.status}): ${JSON.stringify(keysData)}`);
  }

  const apiKey = keysData.apiKey;
  const maskedKey = `${apiKey.slice(0, 8)}...${apiKey.slice(-6)}`;
  console.log('\n====================================================');
  console.log(`  🎉 REAL X402 API KEY ISSUED SUCCESSFULLY!         `);
  console.log(`  API Key: ${maskedKey} (Length: ${apiKey.length} chars)`);
  console.log(`  Balances:`, keysData.balances || 'N/A');
  console.log('====================================================\n');

  // 5. Update .env
  const envPath = path.resolve(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('X402_API_KEY=')) {
    envContent += `\nX402_API_KEY=${apiKey}\n`;
  } else {
    envContent = envContent.replace(/X402_API_KEY=.*/g, `X402_API_KEY=${apiKey}`);
  }
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ Saved X402_API_KEY to .env (securely gitignored)');

  // Update .env.example
  const examplePath = path.resolve(__dirname, '..', '.env.example');
  let exampleContent = fs.readFileSync(examplePath, 'utf8');
  if (!exampleContent.includes('X402_API_KEY=')) {
    exampleContent += `\nX402_API_KEY=x402_live_api_key_here\n`;
    fs.writeFileSync(examplePath, exampleContent, 'utf8');
  }

  return {
    apiKey,
    maskedKey,
    balances: keysData.balances
  };
}

getX402ApiKey().catch(console.error);
