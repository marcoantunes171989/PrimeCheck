import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  const buildSha =
    process.env.VITE_PRIMECHECK_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_PRIMECHECK_SHA': JSON.stringify(buildSha),
    },
    build: {
      target: 'es2020',
      sourcemap: true,
    },
    preview: {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  }
})
