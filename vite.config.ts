import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5287, strictPort: true },
  preview: { port: 4287, strictPort: true },
});
