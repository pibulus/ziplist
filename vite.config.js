import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit()],
  server: {
    port: 3001, // Default ZipList dev port
    host: true, // allows access from other devices on the network
    strictPort: true, // exits if port is already taken (no fallback)
  },
  esbuild: {
    // In production strip debugger + chatty console.log/.debug, but KEEP
    // console.warn/.error so prod still surfaces real failures.
    pure: mode === "production" ? ["console.log", "console.debug"] : [],
    drop: mode === "production" ? ["debugger"] : [],
  },
}));
