import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: { chunkSizeWarningLimit: 700 }, // the Firestore SDK is most of the bundle
  define: { __VERSION__: JSON.stringify(process.env.npm_package_version) },
});
