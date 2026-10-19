import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Бэкенд (uvicorn) по умолчанию слушает 127.0.0.1:8000. Можно переопределить: BACKEND_URL=http://... npm run dev
const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  // Локальный инструмент: один бандл ~1 МБ — норма, предупреждение о размере не нужно.
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    // Явный IPv4: на Windows «localhost» иногда слушается только как ::1, и 127.0.0.1 не открывается.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Прокси: браузер ходит на тот же адрес, что и фронт, — CORS в бэкенде не нужен.
    proxy: {
      '/api': backend,
      '/health': backend,
      '/version': backend,
    },
  },
});
