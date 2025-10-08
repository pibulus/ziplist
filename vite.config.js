import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5174, // Vite default range - avoids macOS ControlCenter on 5000
    host: true, // allows access from other devices on the network
    strictPort: true, // exits if port is already taken (no fallback)
  },
});
