import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Backend replaced with mock data in src/api.ts — no proxy needed
})
