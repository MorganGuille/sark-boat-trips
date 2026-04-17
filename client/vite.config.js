import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  ssr: {
    // Bundle the router into the server build to avoid resolution issues
    noExternal: ["react-router"],
  },
});
