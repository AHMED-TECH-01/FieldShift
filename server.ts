import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { app, logGeminiEvent } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment constraint: Dev server must run on port 3000
const PORT = Number(process.env.APP_PORT) || 3000;

/**
 * Lightweight Vite client shim used ONLY when DISABLE_HMR=true.
 * Vite 8 still injects `/@vite/client` into HTML and CSS imports (`updateStyle`,
 * `removeStyle`, `createHotContext`) even when `server.ws: false`; without this
 * guard, `/@vite/client` attempts a doomed WebSocket connection to port 24678.
 */
const NOOP_VITE_CLIENT_ESM = `
const styleSheets = new Map();

export function updateStyle(id, content) {
  if (typeof document === 'undefined') return;
  let style = styleSheets.get(id) || document.querySelector('style[data-vite-dev-id="' + CSS.escape(id) + '"]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(style);
  }
  style.textContent = content;
  styleSheets.set(id, style);
}

export function removeStyle(id) {
  if (typeof document === 'undefined') return;
  const style = styleSheets.get(id) || document.querySelector('style[data-vite-dev-id="' + CSS.escape(id) + '"]');
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
  styleSheets.delete(id);
}

export function createHotContext() {
  const hot = {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
  return hot;
}

export function injectQuery(url) {
  return url;
}

export class ErrorOverlay extends HTMLElement {}
`;

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const isHttps = Boolean(process.env.APP_URL?.startsWith('https:'));

    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(NOOP_VITE_CLIENT_ESM);
      });
    }

    // In development mode: attach Vite middleware and bind WebSocket HMR directly to httpServer
    // when HMR is enabled, preserving reverse-proxy WSS support over port 443.
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: hmrDisabled
          ? false
          : {
              server: httpServer,
              ...(isHttps ? { clientPort: 443 } : {}),
            },
        hmr: !hmrDisabled,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logGeminiEvent('DEV_SERVER_INITIALIZED', { mode: 'development', port: PORT, hmrDisabled, isHttps });
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
