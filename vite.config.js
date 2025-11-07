import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/enfermagem-urnm-plus/', // <-- adiciona o nome exato do teu repositório no GitHub
})
