import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections
    hmr: {
      host: 'dev.study-saga.com', // Your custom domain
      clientPort: 443, // HTTPS port
      protocol: 'wss', // Secure WebSocket for HMR
    },
  },
})
