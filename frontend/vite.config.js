import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // So the frontend can call /api/* directly without CORS pain in dev —
      // mirrors how the app is likely to be served together in production.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.io needs its own proxy entry with ws:true for the connection upgrade.
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
