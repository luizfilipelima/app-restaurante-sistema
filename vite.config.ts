import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase/supabase-js')) return 'vendor-supabase'
            if (id.includes('lucide-react'))          return 'vendor-lucide'
            if (id.includes('framer-motion'))         return 'vendor-framer-motion'
            if (id.includes('recharts'))              return 'vendor-recharts'
            if (id.includes('@tanstack'))             return 'vendor-tanstack'
            if (id.includes('zustand'))               return 'vendor-zustand'
            if (id.includes('date-fns'))              return 'vendor-date-fns'
            if (id.includes('@radix-ui'))             return 'vendor-radix'
            if (id.includes('xlsx'))                  return 'vendor-xlsx'
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react'
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
