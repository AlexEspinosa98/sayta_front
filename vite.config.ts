import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://sayta.unimagdalena.edu.co',
        changeOrigin: true,
        secure: true,
      },
      '/health': {
        target: 'https://sayta.unimagdalena.edu.co',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
