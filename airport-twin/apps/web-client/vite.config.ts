import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/twin/',
  plugins: [react()],
  server: { proxy: {
    '/api/twin': 'http://localhost:8100', '/ws/twin': { target: 'ws://localhost:8100', ws: true } } },
  build: { outDir: 'dist', emptyOutDir: true },
});
