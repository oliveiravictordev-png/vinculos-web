import { defineConfig } from 'vite';

// Em desenvolvimento, /api é repassado para a API Spring: o navegador vê uma única origem e não há CORS.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
