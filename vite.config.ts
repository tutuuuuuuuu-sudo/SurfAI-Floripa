import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { readFileSync } from "fs"

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Arquivos com "_" (ex: _scoreEngine.ts) nunca são endpoints HTTP — são importados
        // direto pelo client (ver src/lib/surfData.ts). Sem isso, o proxy intercepta essas
        // importações e tenta mandar pro servidor local de API, quebrando `npm run dev`.
        bypass: (req) => { if (req.url?.includes('/api/_')) return req.url },
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
