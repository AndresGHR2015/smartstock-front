import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { GATEWAY_HTTP_PORT = '3001' } = loadEnv(mode, '.', 'GATEWAY_HTTP_PORT');

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: {
        '^/graphql(?:\\?|$)': `http://127.0.0.1:${GATEWAY_HTTP_PORT}`,
      },
    },
  };
});
