import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n🐾 VetConnect Ekiti API listening on http://localhost:${env.port}`);
  console.log(`   Environment: ${env.nodeEnv}`);
  console.log(`   Health:      http://localhost:${env.port}/api/health\n`);
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[server] ${signal} received — shutting down…`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));

process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));

export default server;
