import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    strictPort: true,
    proxy: {
      "/auth": `http://localhost:${process.env.API_PORT || 3001}`,
      "/api": `http://localhost:${process.env.API_PORT || 3001}`,
      "/a": `http://localhost:${process.env.API_PORT || 3001}`,
      "/payment-return": `http://localhost:${process.env.API_PORT || 3001}`,
    },
  },
  build: { outDir: "dist" },
});
