import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Polling is only needed when the source lives on a mounted volume
// (Docker on macOS/Windows, WSL). Docker Compose sets WATCHPACK_POLLING;
// CHOKIDAR_USEPOLLING is the chokidar-native spelling. Without either we
// use native file watching, which is dramatically faster on localhost.
const usePolling =
  process.env.CHOKIDAR_USEPOLLING === 'true' ||
  process.env.WATCHPACK_POLLING === 'true'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
