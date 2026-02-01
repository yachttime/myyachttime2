import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-public',
      closeBundle() {
        const publicDir = 'public';
        const outDir = 'dist';
        try {
          const files = readdirSync(publicDir);
          files.forEach(file => {
            if (file === 'image copy.png') return;
            try {
              const srcPath = join(publicDir, file);
              const destPath = join(outDir, file);
              if (statSync(srcPath).isFile()) {
                copyFileSync(srcPath, destPath);
              }
            } catch (e) {
              console.warn(`Could not copy ${file}:`, e);
            }
          });
        } catch (e) {
          console.warn('Could not copy public files:', e);
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    },
    copyPublicDir: false
  },
  publicDir: 'public',
});
