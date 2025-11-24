import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections
    // HMR auto-detects localhost when no custom config provided
    // Only override for remote dev environments
  },
})
