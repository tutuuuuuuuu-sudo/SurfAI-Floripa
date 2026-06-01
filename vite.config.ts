import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environmentMatchGlobs: [
      ['src/**/*.test.ts', 'jsdom'],
      ['api/**/*.test.ts', 'node'],
    ],
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
