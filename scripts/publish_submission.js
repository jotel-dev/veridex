/**
 * Publish Veridex submission to Celo Builders Agents at Work Hackathon
 */

require('dotenv').config();

const API_KEY = process.env.CELO_BUILDERS_API_KEY || 'sk-celo-hackathon_QPY7CmJZrSqtdUjKqnhQiEpLWLq9j16PlBnbuDQQQ-o';

async function publish() {
  console.log('Publishing Veridex project submission to Celo Builders...');

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`Attempt ${attempt} of 4 connecting to https://celobuilders.xyz/submissions/me/publish...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('https://celobuilders.xyz/submissions/me/publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: true }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        console.error(`Error publishing (HTTP ${res.status}):`, JSON.stringify(data, null, 2));
        process.exit(1);
      }

      console.log('\n======================================================');
      console.log('  🎉 VERIDEX HAS BEEN OFFICIALLY PUBLISHED!          ');
      console.log('======================================================');
      console.log('Project ID:   ', data.id || data.projectId);
      console.log('Status:       ', data.status);
      console.log('Published At: ', data.publishedAt);
      console.log('Server Data:  ', JSON.stringify(data, null, 2));
      console.log('======================================================\n');
      return data;
    } catch (err) {
      console.warn(`Attempt ${attempt} failed:`, err.message);
      if (attempt === 4) throw err;
      console.log('Waiting 3 seconds before retrying...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

publish().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
