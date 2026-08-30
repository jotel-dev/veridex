const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Fetching active hackathons from celobuilders.xyz...');
  const res = await fetch('https://celobuilders.xyz/hackathons');
  const hackathons = await res.json();
  console.log(`Found ${hackathons.length} hackathons:`);
  for (const h of hackathons) {
    console.log(`- Slug: ${h.slug} | Title: ${h.title} | Status: ${h.status}`);
  }

  // Find the Agents at Work hackathon
  let target = hackathons.find(h => h.slug.includes('agent') || h.title.toLowerCase().includes('agent'));
  if (!target) {
    target = hackathons[0];
  }
  console.log(`\nSelected Hackathon: ${target.slug} (${target.title})`);

  // Fetch hackathon details, submission-fields, tracks
  const tracksRes = await fetch(`https://celobuilders.xyz/hackathons/${target.slug}/tracks`);
  const tracks = await tracksRes.json();
  console.log('\nAvailable Tracks:', JSON.stringify(tracks, null, 2));

  const fieldsRes = await fetch(`https://celobuilders.xyz/hackathons/${target.slug}/submission-fields`);
  const fields = await fieldsRes.json();
  console.log('\nSubmission Fields:', JSON.stringify(fields, null, 2));

  // Check sponsor perks
  if (target.metadata && target.metadata.perks) {
    console.log('\nSponsor Perks:', JSON.stringify(target.metadata.perks, null, 2));
  }

  // Start Auth flow
  console.log('\n--- STARTING BUILDER AUTHENTICATION ---');
  const authPayload = {
    hackathonId: target.slug,
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
  console.log('\nAuth Start Response:', JSON.stringify(authData, null, 2));
}

main().catch(console.error);
