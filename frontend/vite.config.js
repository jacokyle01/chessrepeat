import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pouchdb-browser, pouchdb-utils'],
  },
  define: { global: 'window' }, // <--- Add "window" he
});
