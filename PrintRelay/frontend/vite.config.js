import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL?.trim();
    if (!apiUrl) {
      throw new Error('VITE_API_URL must be set to the HTTPS Render API origin for production builds.');
    }

    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error('VITE_API_URL must be a valid HTTPS origin for production builds.');
    }
    if (parsedApiUrl.protocol !== 'https:' || !parsedApiUrl.hostname
      || (parsedApiUrl.pathname !== '/' && parsedApiUrl.pathname !== '')
      || parsedApiUrl.search || parsedApiUrl.hash) {
      throw new Error('VITE_API_URL must be an HTTPS origin without a path, query, or fragment.');
    }
  }

  return { plugins: [react()] };
});
