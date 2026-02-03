import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(), // Merges CSS into the JS file
  ],
  build: {
    rollupOptions: {
      output: {
        // Force a consistent filename (no random hashes)
        entryFileNames: 'assets/voice-widget.js',
        manualChunks: undefined, // Disable splitting
      },
    },
  },
});