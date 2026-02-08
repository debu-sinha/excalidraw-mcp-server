import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  root: 'widget',
  build: {
    outDir: '../dist/widget',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
  },
});
