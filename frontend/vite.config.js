import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],

    server: {
      port: 5173,
      // Same-origin in dev: no CORS preflight, and nothing buffers the SSE stream.
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/healthz': { target: proxyTarget, changeOrigin: true },
        '/readyz': { target: proxyTarget, changeOrigin: true },
      },
    },

    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // Vite 8 bundles with rolldown, which requires the function form.
          // Splitting the highlighter out keeps it off the login/register path.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'react'
            }
            if (/[\\/]node_modules[\\/](react-markdown|remark-|micromark|mdast-|hast-|unist-|react-syntax-highlighter|refractor|prismjs)/.test(id)) {
              return 'markdown'
            }
            return undefined
          },
        },
      },
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/test/**', 'src/main.jsx', '**/*.test.{js,jsx}'],
        thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      },
    },
  }
})
