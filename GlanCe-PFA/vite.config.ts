import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'HUGGINGFACE_', 'HF_', 'QWEN_', 'MISTRAL_', 'ANTHROPIC_', 'OPENAI_', 'GROQ_', 'GEMINI_'],
    define: {
      'process.env.HUGGINGFACE_API_KEY': JSON.stringify(
        env.HUGGINGFACE_API_KEY || env.HF_TOKEN || env.HF_API_KEY || env.VITE_HUGGINGFACE_API_KEY || env.VITE_HF_TOKEN || env.QWEN_API_KEY || env.VITE_QWEN_API_KEY || ''
      ),
      'process.env.HF_TOKEN': JSON.stringify(env.HF_TOKEN || env.HUGGINGFACE_API_KEY || env.VITE_HF_TOKEN || ''),
      'process.env.QWEN_API_KEY': JSON.stringify(env.QWEN_API_KEY || env.VITE_QWEN_API_KEY || env.HUGGINGFACE_API_KEY || env.HF_TOKEN || ''),
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api/hf-proxy': {
          target: 'https://router.huggingface.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/hf-proxy/, ''),
        },
        '/api/hf-api-proxy': {
          target: 'https://api-inference.huggingface.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/hf-api-proxy/, ''),
        },
        '/api/openrouter-proxy': {
          target: 'https://openrouter.ai',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/openrouter-proxy/, ''),
        },
        '/api/dashscope-proxy': {
          target: 'https://dashscope.aliyuncs.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/dashscope-proxy/, ''),
        },
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
  };
});
