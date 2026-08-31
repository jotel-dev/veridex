/**
 * Veridex - Server Entrypoint
 */

const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🛡️  VERIDEX WEB SERVER & REST API RUNNING            `);
  console.log(`======================================================`);
  console.log(`  • Web UI:      http://localhost:${PORT}`);
  console.log(`  • API Base:    http://localhost:${PORT}/api`);
  console.log(`  • Health:      http://localhost:${PORT}/api/health`);
  console.log(`  • Info:        http://localhost:${PORT}/api/info`);
  console.log(`======================================================\n`);
});
