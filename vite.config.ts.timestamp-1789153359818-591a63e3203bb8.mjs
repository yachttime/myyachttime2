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
    include: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjb3B5RmlsZVN5bmMsIHJlYWRkaXJTeW5jLCBzdGF0U3luYywgbWtkaXJTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAge1xuICAgICAgbmFtZTogJ2NvcHktcHVibGljJyxcbiAgICAgIGNsb3NlQnVuZGxlKCkge1xuICAgICAgICBjb25zdCBwdWJsaWNEaXIgPSAncHVibGljJztcbiAgICAgICAgY29uc3Qgb3V0RGlyID0gJ2Rpc3QnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGZpbGVzID0gcmVhZGRpclN5bmMocHVibGljRGlyKTtcbiAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGUgPT09ICdpbWFnZSBjb3B5LnBuZycpIHJldHVybjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHNyY1BhdGggPSBqb2luKHB1YmxpY0RpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGNvbnN0IGRlc3RQYXRoID0gam9pbihvdXREaXIsIGZpbGUpO1xuICAgICAgICAgICAgICBpZiAoc3RhdFN5bmMoc3JjUGF0aCkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICBjb3B5RmlsZVN5bmMoc3JjUGF0aCwgZGVzdFBhdGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihgQ291bGQgbm90IGNvcHkgJHtmaWxlfTpgLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybignQ291bGQgbm90IGNvcHkgcHVibGljIGZpbGVzOicsIGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICBdLFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC9qc3gtcnVudGltZScsICdsdWNpZGUtcmVhY3QnXSxcbiAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgbG9hZGVyOiB7XG4gICAgICAgICcuanMnOiAnanN4JyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGRlZHVwZTogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiB0cnVlLFxuICAgICAgcHJvdG9jb2w6ICd3cycsXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgdXNlUG9sbGluZzogdHJ1ZSxcbiAgICB9LFxuICAgIGNvcnM6IHRydWUsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiBgYXNzZXRzL1tuYW1lXS5baGFzaF0uanNgLFxuICAgICAgICBjaHVua0ZpbGVOYW1lczogYGFzc2V0cy9bbmFtZV0uW2hhc2hdLmpzYCxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6IGBhc3NldHMvW25hbWVdLltoYXNoXS5bZXh0XWBcbiAgICAgIH1cbiAgICB9LFxuICAgIGNvcHlQdWJsaWNEaXI6IGZhbHNlXG4gIH0sXG4gIHB1YmxpY0RpcjogJ3B1YmxpYycsXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsY0FBYyxhQUFhLGdCQUEyQjtBQUMvRCxTQUFTLFlBQVk7QUFHckIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ047QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLGNBQWM7QUFDWixjQUFNLFlBQVk7QUFDbEIsY0FBTSxTQUFTO0FBQ2YsWUFBSTtBQUNGLGdCQUFNLFFBQVEsWUFBWSxTQUFTO0FBQ25DLGdCQUFNLFFBQVEsVUFBUTtBQUNwQixnQkFBSSxTQUFTLGlCQUFrQjtBQUMvQixnQkFBSTtBQUNGLG9CQUFNLFVBQVUsS0FBSyxXQUFXLElBQUk7QUFDcEMsb0JBQU0sV0FBVyxLQUFLLFFBQVEsSUFBSTtBQUNsQyxrQkFBSSxTQUFTLE9BQU8sRUFBRSxPQUFPLEdBQUc7QUFDOUIsNkJBQWEsU0FBUyxRQUFRO0FBQUEsY0FDaEM7QUFBQSxZQUNGLFNBQVMsR0FBRztBQUNWLHNCQUFRLEtBQUssa0JBQWtCLElBQUksS0FBSyxDQUFDO0FBQUEsWUFDM0M7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNILFNBQVMsR0FBRztBQUNWLGtCQUFRLEtBQUssZ0NBQWdDLENBQUM7QUFBQSxRQUNoRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFNBQVMsYUFBYSxxQkFBcUIsY0FBYztBQUFBLElBQ25FLGdCQUFnQjtBQUFBLE1BQ2QsUUFBUTtBQUFBLFFBQ04sT0FBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLEVBQy9CO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsTUFDVCxVQUFVO0FBQUEsSUFDWjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLElBQ2Q7QUFBQSxJQUNBLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGVBQWU7QUFBQSxFQUNqQjtBQUFBLEVBQ0EsV0FBVztBQUNiLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
