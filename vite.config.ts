import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    allowedHosts: true,
    proxy: {
      '/erp-api': {
        target: 'http://152.200.146.226:50010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/erp-api/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        app: resolve(projectRoot, 'index.html'),
        redirect: resolve(projectRoot, 'redirect.html'),
      },
    },
  },
});
