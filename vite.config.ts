import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    fs: {
      allow: ["./client", "./shared", "index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
    proxy: {
      "/ai": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/api/admin-ai": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/live-chat": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
      },
    },
    allowedHosts: true
  },
  
  allowedHosts: ['.loca.lt', 'all'],
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Skip Express middleware for proxied routes (/ai, /api/admin-ai, etc.)
      // to avoid express.json() consuming the body stream before Vite proxy forwards it
      server.middlewares.use((req, res, next) => {
        if (
          req.url &&
          (req.url.startsWith("/ai") ||
            req.url.startsWith("/api/admin-ai") ||
            req.url.startsWith("/live-chat"))
        ) {
          return next();
        }
        app(req, res, next);
      });
    },
  };
}
