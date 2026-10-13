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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        app: resolve(projectRoot, 'index.html'),
        redirect: resolve(projectRoot, 'redirect.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('exceljs')) {
              return 'vendor-excel';
            }
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory') || id.includes('decimal.js')) {
              return 'vendor-charts';
            }
            if (id.includes('@azure/msal') || id.includes('@microsoft/microsoft-graph-client')) {
              return 'vendor-msal';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
});
