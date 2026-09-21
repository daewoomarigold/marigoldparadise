import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Repo is served at https://daewoomarigold.github.io/marigoldparadise/,
  // so all built asset paths need this prefix.
  base: '/marigoldparadise/',
  build: {
    // Three real, separately-built pages — teacher.html/gotchigarden.html
    // were two separate static pages in the old repo, and this is that
    // same shape (see teacher/index.html, island/index.html): actual
    // static HTML files GitHub Pages serves directly at /teacher/ and
    // /island/, not one SPA faking routes via a query param. `main` is
    // the root index.html, which just redirects to /teacher/ — see its
    // own comment for why.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        teacher: resolve(import.meta.dirname, 'teacher/index.html'),
        island: resolve(import.meta.dirname, 'island/index.html'),
      },
    },
  },
})
