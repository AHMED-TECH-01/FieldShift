import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { app, logGeminiEvent } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment constraint: Dev server must run on port 3000
const PORT = Number(process.env.APP_PORT) || 3000;

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    // In development mode: attach Vite middleware and hook HMR/WS upgrade to httpServer
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {
          server: httpServer,
        },
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logGeminiEvent('DEV_SERVER_INITIALIZED', { mode: 'development', port: PORT });
  } else {
    // In production mode (when running standalone Node server): serve pre-built distribution assets directly
    const distPath = path.resolve(__dirname, 'dist');
    const express = (await import('express')).default;
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    logGeminiEvent('PROD_SERVER_INITIALIZED', { mode: 'production', distPath, port: PORT });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[FieldShift] Server listening on http://0.0.0.0:${PORT} in ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  });
}

startServer();
