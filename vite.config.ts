import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(() => {
  const hmrDisabled = process.env.DISABLE_HMR === 'true';
  const isHttps = Boolean(process.env.APP_URL?.startsWith('https:'));

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      port: Number(process.env.APP_PORT) || 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // Use Vite 8 `server.ws` directly so HTTPS reverse proxies connect via WSS port 443
      // without falling back to standalone port 24678.
      ws: hmrDisabled
        ? (false as const)
        : {
            ...(isHttps ? { clientPort: 443 } : {}),
          },
      hmr: !hmrDisabled,
      // Disable file watching only when DISABLE_HMR=true in headless/container environments.
      watch: hmrDisabled ? null : {},
    },
  };
});
