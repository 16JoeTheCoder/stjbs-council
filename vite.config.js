import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Two pages from one build: the public site at / and the members' dashboard at /app/.
export default defineConfig({
  plugins: [preact()],
  build: {
    chunkSizeWarningLimit: 800, // the Firestore SDK with its offline cache is most of the dashboard bundle
    rollupOptions: { input: { site: 'index.html', app: 'app/index.html' } },
  },
  define: { __VERSION__: JSON.stringify(process.env.npm_package_version) },
});
