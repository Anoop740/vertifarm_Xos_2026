import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// In Docker dev: BACKEND_URL=http://backend:8000 (container-to-container)
// In local dev:  BACKEND_URL=http://localhost:8000
const backendUrl = process.env.BACKEND_URL || process.env.VITE_API_URL || 'http://localhost:8000'
const wsUrl = process.env.BACKEND_WS_URL || process.env.VITE_WS_URL || 'ws://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: wsUrl,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
