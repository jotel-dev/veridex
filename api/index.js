/**
 * Vercel Serverless Catch-All Entrypoint
 * 
 * Exports the Express app instance for Vercel Serverless Functions.
 */

const app = require('../src/server/app');

module.exports = app;
