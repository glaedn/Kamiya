import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const webPort = Number(process.env.KAMIYA_VITE_PORT ?? 5173);
const apiPort = Number(process.env.KAMIYA_API_PORT ?? 4177);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: webPort,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true
      }
    }
  }
});
