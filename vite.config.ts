import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => {
  const debug = mode === 'workshop-debug';
  return {
    root: resolve('src/desktop/renderer'),
    base: './',
    plugins: [react()],
    build: { outDir: resolve(debug ? 'dist-debug/renderer' : 'dist/renderer'), emptyOutDir: true, sourcemap: debug, minify: debug ? false : undefined, cssMinify: debug ? false : undefined },
    worker: { format: 'es' }
  };
});
