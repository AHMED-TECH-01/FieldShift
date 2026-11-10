import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(() => {
  const isHttps = process.env.APP_URL?.startsWith('https:');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      // HMR is enabled for local dev/preview, configured for reverse-proxy WSS when on HTTPS
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : {
            clientPort: isHttps ? 443 : undefined,
          },
      // Disable file watching only when DISABLE_HMR is true to save CPU during agent edits
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
