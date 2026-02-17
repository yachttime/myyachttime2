// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import { copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "copy-public",
      closeBundle() {
        const publicDir = "public";
        const outDir = "dist";
        try {
          const files = readdirSync(publicDir);
          files.forEach((file) => {
            if (file === "image copy.png") return;
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
          console.warn("Could not copy public files:", e);
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ["lucide-react"],
    include: ["react", "react-dom", "react/jsx-runtime"],
    esbuildOptions: {
      loader: {
        ".js": "jsx"
      }
    }
  },
  resolve: {
    dedupe: ["react", "react-dom"]
  },
  server: {
    hmr: {
      overlay: true,
      protocol: "ws"
    },
    watch: {
      usePolling: true
    },
    cors: true
  },
  build: {
    outDir: "dist",
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
  publicDir: "public"
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjb3B5RmlsZVN5bmMsIHJlYWRkaXJTeW5jLCBzdGF0U3luYywgbWtkaXJTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogJ2NvcHktcHVibGljJyxcbiAgICAgIGNsb3NlQnVuZGxlKCkge1xuICAgICAgICBjb25zdCBwdWJsaWNEaXIgPSAncHVibGljJztcbiAgICAgICAgY29uc3Qgb3V0RGlyID0gJ2Rpc3QnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGZpbGVzID0gcmVhZGRpclN5bmMocHVibGljRGlyKTtcbiAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGUgPT09ICdpbWFnZSBjb3B5LnBuZycpIHJldHVybjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHNyY1BhdGggPSBqb2luKHB1YmxpY0RpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGNvbnN0IGRlc3RQYXRoID0gam9pbihvdXREaXIsIGZpbGUpO1xuICAgICAgICAgICAgICBpZiAoc3RhdFN5bmMoc3JjUGF0aCkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICBjb3B5RmlsZVN5bmMoc3JjUGF0aCwgZGVzdFBhdGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihgQ291bGQgbm90IGNvcHkgJHtmaWxlfTpgLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybignQ291bGQgbm90IGNvcHkgcHVibGljIGZpbGVzOicsIGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICBdLFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICAgIGluY2x1ZGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0L2pzeC1ydW50aW1lJ10sXG4gICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgIGxvYWRlcjoge1xuICAgICAgICAnLmpzJzogJ2pzeCcsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBkZWR1cGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogdHJ1ZSxcbiAgICAgIHByb3RvY29sOiAnd3MnLFxuICAgIH0sXG4gICAgd2F0Y2g6IHtcbiAgICAgIHVzZVBvbGxpbmc6IHRydWUsXG4gICAgfSxcbiAgICBjb3JzOiB0cnVlLFxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBlbnRyeUZpbGVOYW1lczogYGFzc2V0cy9bbmFtZV0uW2hhc2hdLmpzYCxcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6IGBhc3NldHMvW25hbWVdLltoYXNoXS5qc2AsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiBgYXNzZXRzL1tuYW1lXS5baGFzaF0uW2V4dF1gXG4gICAgICB9XG4gICAgfSxcbiAgICBjb3B5UHVibGljRGlyOiBmYWxzZVxuICB9LFxuICBwdWJsaWNEaXI6ICdwdWJsaWMnLFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixTQUFTLGNBQWMsYUFBYSxnQkFBMkI7QUFDL0QsU0FBUyxZQUFZO0FBR3JCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixjQUFjO0FBQ1osY0FBTSxZQUFZO0FBQ2xCLGNBQU0sU0FBUztBQUNmLFlBQUk7QUFDRixnQkFBTSxRQUFRLFlBQVksU0FBUztBQUNuQyxnQkFBTSxRQUFRLFVBQVE7QUFDcEIsZ0JBQUksU0FBUyxpQkFBa0I7QUFDL0IsZ0JBQUk7QUFDRixvQkFBTSxVQUFVLEtBQUssV0FBVyxJQUFJO0FBQ3BDLG9CQUFNLFdBQVcsS0FBSyxRQUFRLElBQUk7QUFDbEMsa0JBQUksU0FBUyxPQUFPLEVBQUUsT0FBTyxHQUFHO0FBQzlCLDZCQUFhLFNBQVMsUUFBUTtBQUFBLGNBQ2hDO0FBQUEsWUFDRixTQUFTLEdBQUc7QUFDVixzQkFBUSxLQUFLLGtCQUFrQixJQUFJLEtBQUssQ0FBQztBQUFBLFlBQzNDO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDSCxTQUFTLEdBQUc7QUFDVixrQkFBUSxLQUFLLGdDQUFnQyxDQUFDO0FBQUEsUUFDaEQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsSUFDeEIsU0FBUyxDQUFDLFNBQVMsYUFBYSxtQkFBbUI7QUFBQSxJQUNuRCxnQkFBZ0I7QUFBQSxNQUNkLFFBQVE7QUFBQSxRQUNOLE9BQU87QUFBQSxNQUNUO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFBQSxFQUMvQjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLE1BQ1QsVUFBVTtBQUFBLElBQ1o7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFlBQVk7QUFBQSxJQUNkO0FBQUEsSUFDQSxNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsTUFDbEI7QUFBQSxJQUNGO0FBQUEsSUFDQSxlQUFlO0FBQUEsRUFDakI7QUFBQSxFQUNBLFdBQVc7QUFDYixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
