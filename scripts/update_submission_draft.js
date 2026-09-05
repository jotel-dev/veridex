/**
 * Update Celo Builders Submission Draft (DO NOT PUBLISH)
 */

require('dotenv').config();

const API_KEY = process.env.CELO_BUILDERS_API_KEY;
if (!API_KEY) {
  console.error('Error: CELO_BUILDERS_API_KEY is not set in environment or .env');
  process.exit(1);
}

const submissionPayload = {
  projectName: "Veridex",
  tagline: "Autonomous AI Security Gate & Gasless Stablecoin Payments on Celo",
  description: "Veridex is an autonomous AI security gate that protects users from web3 scams before executing gas-sponsored stablecoin transfers on Celo. Incoming messages, links, and transaction requests are evaluated through a multi-layer security engine (regex heuristics, URL lookalike detection, support impersonation guards, and contextual Google Gemini LLM reasoning). Safe transfers are executed gaslessly via EIP-3009 interactive MetaMask signing, settling over the x402 facilitator (or direct fallback relay when token preflight requires it), tagged with ERC-8021 on-chain attribution (celo_ef9178addda4), and anchored to an on-chain ERC-8004 agent identity (#9797).",
  trackIds: [
    "real-world-adoption",
    "judges-favorite"
  ],
  bountyIds: [
    "best-real-world-adoption",
    "best-stablecoin-adoption",
    "judges-favorite"
  ],
  celoNetwork: "celo-mainnet",
  contractAddresses: [
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  ],
  githubUrl: "https://github.com/jotel-dev/veridex",
  demoUrl: "https://veridex-brown.vercel.app",
  socialLink: "https://x.com/Jotel001/status/2095456699045773389",
  agentContributionNotes: "Google Antigravity paired autonomously to architect and build the full stack: EIP-3009 transferWithAuthorization typed signing, multi-layer scam detection with Google Gemini LLM fallback, x402 facilitator settlement with automated direct relay fallback, ERC-8021 on-chain attribution tag encoding, rate limiting, and maximum transfer security caps.",
  customFields: {
    primaryTrack: "real-world-adoption",
    telegram: "@jotel001",
    country: "Nigeria",
    erc8004Url: "https://8004scan.io/agents/celo/9797",
    agentWalletAddress: "0xEd1E7722c3fC67f31B9bCdCF7B71770bB2989321",
    stablecoinsUsed: ["USAT", "USDC"],
    additionalTrackRationale: "Judges' Favorite: Autonomous AI security gate that intercepts social engineering, drainer lures, and approval scams before initiating sponsored stablecoin payments for real-world adoption.",
    cpayBetaOptIn: true,
    appDomain: "https://veridex-brown.vercel.app"
  }
};

async function updateDraft() {
  console.log('Updating submission draft on Celo Builders (DO NOT PUBLISH)...');
  
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`Attempt ${attempt} of 4 connecting to https://celobuilders.xyz...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('https://celobuilders.xyz/submissions/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        console.error('Error updating draft (HTTP ' + res.status + '):', JSON.stringify(data, null, 2));
        process.exit(1);
      }

      console.log('\n✅ Successfully updated draft! (Status: ' + res.status + ')');
      console.log('\n--- SERVER RESPONSE ---');
      console.log(JSON.stringify(data, null, 2));
      return data;
    } catch (err) {
      console.warn(`Attempt ${attempt} failed:`, err.message);
      if (attempt === 4) throw err;
      console.log('Waiting 3 seconds before retrying...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

updateDraft().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
