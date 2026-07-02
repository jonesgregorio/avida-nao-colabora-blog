import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'admin': [
            './src/components/admin/AdminPersonalization',
            './src/components/admin/AdminUsers',
            './src/components/admin/AdminArticleEditor',
          ],
        },
      },
    },
  },
})
