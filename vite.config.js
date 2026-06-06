import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose sur le réseau local (LAN) pour scanner le QR depuis un tel
  },
});
