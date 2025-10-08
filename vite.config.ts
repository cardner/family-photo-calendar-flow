import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Dev proxy for Notion API to avoid exposing token via third-party CORS proxies
      '/notion': {
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/notion/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Ensure Notion-Version header present if user code forgot (belt & suspenders)
            if (!proxyReq.getHeader('Notion-Version')) {
              proxyReq.setHeader('Notion-Version', '2022-06-28');
            }
          });
        }
      }
    }
  },
  test: {
    environment: 'happy-dom', // or 'happy-dom'
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
