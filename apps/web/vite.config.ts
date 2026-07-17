import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "../../",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        timeout: 8000,
        proxyTimeout: 8000,
        rewrite: (path) => path.replace(/^\/deezer/, ""),
      },
    },
  },
});
