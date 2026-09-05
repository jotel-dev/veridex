/**
 * Celo Builders Claim & Register Script
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function registerWithApiKey(apiKey) {
  console.log('✅ Using API Key:', apiKey.slice(0, 20) + '...');

  // 1. Verify participant profile
  const meRes = await fetch('https://celobuilders.xyz/participants/me', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  const meData = await meRes.json();
  console.log('\n[1] Participant Profile:', JSON.stringify(meData, null, 2));

  // 2. Build registration payload according to Celo Builders hackathon fields
  const registrationPayload = {
    projectName: "Veridex",
    githubUrl: "https://github.com/jotel-dev/veridex",
    trackIds: ["real-world-adoption"],
    customFields: {
      telegram: "@jotel001",
      primaryTrack: "real-world-adoption",
      erc8004Url: "https://8004scan.io/agents/celo/9797",
      agentWalletAddress: "0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321",
      country: "Nigeria",
      cpayBetaOptIn: true,
      reviewerAgentWallets: ""
    }
  };

  console.log('\n[2] Registering project submission draft on Celo Builders...');
  const subRes = await fetch('https://celobuilders.xyz/submissions/me', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(registrationPayload)
  });

  const subData = await subRes.json();
  if (!subRes.ok) {
    console.error('Submission draft failed:', subData);
    throw new Error(`Registration failed: ${JSON.stringify(subData)}`);
  }

  console.log('\n====================================================');
  console.log('  🎉 VERIDEX REGISTERED ON CELO BUILDERS!          ');
  console.log('====================================================');
  console.log(`ATTRIBUTION TAG:    ${subData.attributionTag}`);
  console.log(`PROJECT ID:         ${subData.id || subData.projectId}`);
  console.log(`STATUS:             ${subData.status}`);

  // Fetch hackathon details to get perks / coupon
  const hackathonRes = await fetch('https://celobuilders.xyz/hackathons/agents-at-work');
  const hackathonData = await hackathonRes.json();
  const perks = hackathonData.metadata?.perks || null;
  const coupon = "AGENTSATWORK"; // Chainstack Growth plan coupon for Agents at Work hackathon

  console.log(`CHAINSTACK COUPON:  ${coupon}`);
  console.log('====================================================\n');

  // Save to config/hackathon.json
  const configDir = path.resolve(__dirname, '..', 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const hackathonConfig = {
    hackathon: "agents-at-work",
    projectName: "Veridex",
    githubUrl: "https://github.com/jotel-dev/veridex",
    attributionTag: subData.attributionTag,
    agentId: "9797",
    agentWalletAddress: "0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321",
    primaryTrack: "Track 2 - Real World Adoption (Best Stablecoin Adoption subtrack)",
    trackSlug: "real-world-adoption",
    country: "Nigeria",
    telegram: "@jotel001",
    cpayBetaOptIn: true,
    chainstackCoupon: coupon,
    registeredAt: new Date().toISOString()
  };

  fs.writeFileSync(path.resolve(configDir, 'hackathon.json'), JSON.stringify(hackathonConfig, null, 2), 'utf8');
  console.log('✅ Saved configuration to config/hackathon.json');

  // Update .env with ATTRIBUTION_TAG & CHAINSTACK_COUPON
  const envPath = path.resolve(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('CELO_ATTRIBUTION_TAG=')) {
    envContent += `\nCELO_ATTRIBUTION_TAG=${subData.attributionTag}\nCHAINSTACK_COUPON=${coupon}\nCELO_BUILDERS_API_KEY=${apiKey}\n`;
  } else {
    envContent = envContent.replace(/CELO_ATTRIBUTION_TAG=.*/g, `CELO_ATTRIBUTION_TAG=${subData.attributionTag}`);
    if (!envContent.includes('CHAINSTACK_COUPON=')) {
      envContent += `\nCHAINSTACK_COUPON=${coupon}\n`;
    }
  }
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ Updated .env with attribution tag and coupon');

  // Update .env.example
  const examplePath = path.resolve(__dirname, '..', '.env.example');
  let exampleContent = fs.readFileSync(examplePath, 'utf8');
  if (!exampleContent.includes('CELO_ATTRIBUTION_TAG=')) {
    exampleContent += `\nCELO_ATTRIBUTION_TAG=celo_your_assigned_tag\nCHAINSTACK_COUPON=AGENTSATWORK\nCELO_BUILDERS_API_KEY=sk-celo-hackathon_...\n`;
    fs.writeFileSync(examplePath, exampleContent, 'utf8');
  }

  return {
    attributionTag: subData.attributionTag,
    coupon,
    subData
  };
}

// Execute with environment API key
const claimedApiKey = process.env.CELO_BUILDERS_API_KEY;
if (!claimedApiKey) {
  console.error('CELO_BUILDERS_API_KEY is not set in environment or .env');
  process.exit(1);
}
registerWithApiKey(claimedApiKey).catch(console.error);
