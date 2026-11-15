import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev`    → http://localhost:5173 (desktop / mobile)
// `npm run dev:vr` → https://<your-LAN-IP>:5173 (WebXR on Meta Quest needs HTTPS)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'vr' ? [basicSsl()] : [],
  server: { port: 5173, strictPort: true, open: true, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
}));
