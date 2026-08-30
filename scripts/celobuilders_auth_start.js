/**
 * Celo Builders Auth Helper
 */

async function startAuth() {
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
  console.log('AUTHORIZE_URL:', authData.authorizeUrl);
}

startAuth().catch(console.error);
