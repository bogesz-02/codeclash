import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	// Serve repository-level assets (images) so we can use /cards/*.png in the app
	publicDir: resolve(dirname(fileURLToPath(import.meta.url)), "../assets"),
});
