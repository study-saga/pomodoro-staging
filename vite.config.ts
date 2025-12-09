import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections
    // HMR auto-detects localhost when no custom config provided
    // Only override for remote dev environments
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure we don't have conflicting chunk names
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
