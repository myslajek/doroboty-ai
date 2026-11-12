import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { assistantBridge } from "./assistant/vite-plugin.mjs";

export default defineConfig({
  plugins: [react(), tailwindcss(), assistantBridge()],
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
