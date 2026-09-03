// Vercel serverless entrypoint for the VetConnect Ekiti API.
// Vercel routes every request here (see vercel.json); the Express app — which
// already mounts its routes under /api — handles the original URL directly.
// We import createApp (NOT server.js) so app.listen() is never called.
import { createApp } from '../src/app.js';

const app = createApp();

export default app;
