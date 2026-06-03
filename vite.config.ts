import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const isExtension = process.env.BUILD_TARGET === 'extension';

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ...(isExtension ? {
    base: './',
    build: {
      outDir: 'dist-extension',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          panel: path.resolve(__dirname, 'panel.html'),
          background: path.resolve(__dirname, 'src/background/service-worker.ts'),
          content: path.resolve(__dirname, 'src/content/content.ts'),
        },
        output: {
          entryFileNames: (chunk) => {
            if (chunk.name === 'background' || chunk.name === 'content') {
              return '[name].js';
            }
            return 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    publicDir: 'public',
  } : {}),
}));
