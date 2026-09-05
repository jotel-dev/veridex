/**
 * Celo Builders Key Rotation Helper
 * 
 * Usage:
 *   1. Step 1: Start auth to get your Google sign-in link:
 *      node scripts/rotate_celobuilders_key.js
 * 
 *   2. Step 2: Open the link in browser, sign in with your team Google account, and copy the short code (e.g. CELO-ABCD-1234).
 * 
 *   3. Step 3: Exchange the claim code for a fresh API key and auto-update .env:
 *      node scripts/rotate_celobuilders_key.js CELO-ABCD-1234
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CLAIM_CODE = process.argv[2];

async function startFlow() {
  console.log('Initiating Celo Builders Google Auth session...');
  const authPayload = {
    hackathonId: "agents-at-work",
    human: {
      name: "Veridex Team",
      social: "@jotel001",
      teamName: "Veridex"
    },
    agent: {
      name: "Veridex Agent",
      harness: "antigravity",
      model: "gemini-3.7-flash"
    }
  };

  const startRes = await fetch('https://celobuilders.xyz/auth/google/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authPayload)
  });

  const authData = await startRes.json();
  if (!startRes.ok || !authData.authorizeUrl) {
    console.error('Failed to start auth session:', authData);
    process.exit(1);
  }

  console.log('\n========================================================================');
  console.log('  👉 STEP 1: OPEN THIS GOOGLE SIGN-IN URL IN YOUR BROWSER:');
  console.log('========================================================================');
  console.log(authData.authorizeUrl);
  console.log('========================================================================\n');
  console.log('Once you sign in, the browser will display a short code (e.g. CELO-XXXX-XXXX).');
  console.log('Run the following command to finish rotation and auto-update .env:');
  console.log('  node scripts/rotate_celobuilders_key.js <YOUR-CLAIM-CODE>\n');
}

async function claimCode(code) {
  console.log(`Exchanging claim code ${code} for a new API key...`);
  const claimRes = await fetch('https://celobuilders.xyz/auth/google/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimCode: code.trim() })
  });

  const claimData = await claimRes.json();
  if (!claimRes.ok || !claimData.token) {
    console.error('Claim failed:', claimData);
    process.exit(1);
  }

  const newToken = claimData.token;
  const maskedToken = `${newToken.slice(0, 15)}...${newToken.slice(-6)}`;

  // Update .env securely
  const envPath = path.resolve(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  if (envContent.includes('CELO_BUILDERS_API_KEY=')) {
    envContent = envContent.replace(/CELO_BUILDERS_API_KEY=.*/g, `CELO_BUILDERS_API_KEY=${newToken}`);
  } else {
    envContent += `\nCELO_BUILDERS_API_KEY=${newToken}\n`;
  }
  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log('\n========================================================================');
  console.log('  🎉 NEW CELO BUILDERS API KEY ISSUED & SAVED TO .env');
  console.log(`  Key: ${maskedToken}`);
  console.log('========================================================================\n');

  // Verify auth against live API
  console.log('Verifying auth with live server using the new key...');
  const verifyRes = await fetch('https://celobuilders.xyz/submissions/me', {
    headers: { 'Authorization': `Bearer ${newToken}` }
  });

  if (verifyRes.ok) {
    const sub = await verifyRes.json();
    console.log(`✅ Auth successful! Submission status: "${sub.status}" for project "${sub.projectName}"`);
  } else {
    console.warn(`⚠️ Warning: Server returned status ${verifyRes.status}`);
  }
}

if (!CLAIM_CODE) {
  startFlow().catch(console.error);
} else {
  claimCode(CLAIM_CODE).catch(console.error);
}
