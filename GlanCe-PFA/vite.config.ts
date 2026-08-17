import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/mistral-proxy': {
        target: 'https://api.mistral.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/mistral-proxy/, ''),
      },
      '/api/anthropic-proxy': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic-proxy/, ''),
      },
      '/api/groq-proxy': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/groq-proxy/, ''),
      },
      '/api/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/openai-proxy/, ''),
      },
    },
  },
});

