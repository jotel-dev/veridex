require('dotenv').config();

const API_KEY = process.env.CELO_BUILDERS_API_KEY;
if (!API_KEY) {
  console.error('Error: CELO_BUILDERS_API_KEY is not set in environment or .env');
  process.exit(1);
}

async function check() {
  console.log('--- 1. Fetching Current Submission Draft ---');
  const subRes = await fetch('https://celobuilders.xyz/submissions/me', {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  console.log('Submission Status:', subRes.status);
  const subData = await subRes.json();
  console.log('Current Submission:', JSON.stringify(subData, null, 2));

  console.log('\n--- 2. Fetching Hackathon Submission Fields ---');
  const fieldsRes = await fetch('https://celobuilders.xyz/hackathons/agents-at-work/submission-fields');
  const fieldsData = await fieldsRes.json();
  console.log('Submission Fields:', JSON.stringify(fieldsData, null, 2));

  console.log('\n--- 3. Fetching Hackathon Tracks ---');
  const tracksRes = await fetch('https://celobuilders.xyz/hackathons/agents-at-work/tracks');
  const tracksData = await tracksRes.json();
  console.log('Tracks:', JSON.stringify(tracksData, null, 2));

  console.log('\n--- 4. Fetching Hackathon Bounties ---');
  const bountiesRes = await fetch('https://celobuilders.xyz/hackathons/agents-at-work/bounties');
  const bountiesData = await bountiesRes.json();
  console.log('Bounties:', JSON.stringify(bountiesData, null, 2));
}

check().catch(console.error);
