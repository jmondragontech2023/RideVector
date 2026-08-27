import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

/** LAN phone testing: browsers only allow geolocation on HTTPS (or localhost). */
const mobileLan = process.env.RIDEVECTOR_MOBILE_LAN === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(mobileLan
      ? [
          basicSsl({
            name: 'ridevector-poc-mobile',
          }),
        ]
      : []),
  ],
  server: {
    host: mobileLan ? true : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
