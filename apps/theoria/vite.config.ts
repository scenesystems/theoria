import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const apiPort = process.env.THEORIA_PORT ?? "3876"
const vitePort = 5175

/**
 * Chunk groups. Rolldown evaluates `priority` before order. Vendor groups
 * outrank the workspace groups because Bun's isolated install links `effect`
 * and the UI vendors beneath each workspace package
 * (`packages/effect-text/node_modules/effect/...`), so a workspace regex would
 * otherwise claim the Effect runtime for itself. The workspace packages live
 * under `packages/` in dev and `node_modules/@scenesystems/` once built.
 */
const chunkGroups = [
  { name: "react-vendor", test: /\/node_modules\/(?:react|react-dom|scheduler)\//, priority: 40 },
  { name: "effect-core", test: /\/node_modules\/(?:effect|@effect|@effect-atom)\//, priority: 30 },
  { name: "ui-vendor", test: /\/node_modules\/(?:@base-ui|@heroicons|motion|framer-motion)\//, priority: 30 },
  { name: "effect-text", test: /\/(?:packages|node_modules\/@scenesystems)\/effect-text\//, priority: 20 },
  { name: "effect-search", test: /\/(?:packages|node_modules\/@scenesystems)\/effect-search\//, priority: 20 },
  { name: "effect-math", test: /\/(?:packages|node_modules\/@scenesystems)\/effect-math\//, priority: 20 }
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: chunkGroups
        }
      }
    }
  },
  server: {
    port: vitePort,
    strictPort: true,
    allowedHosts: [".onamp.dev"],
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true
      }
    }
  }
})
