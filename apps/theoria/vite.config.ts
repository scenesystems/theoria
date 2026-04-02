import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const apiPort = process.env.THEORIA_PORT ?? "3876"
const vitePort = 5175

const manualChunkNameFor = (id: string): string | undefined => {
  if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
    return "react-vendor"
  }

  if (id.includes("/node_modules/effect/") || id.includes("/node_modules/@effect/") || id.includes("/node_modules/@effect-atom/")) {
    return "effect-core"
  }

  if (id.includes("/packages/effect-text/") || id.includes("/node_modules/effect-text/")) {
    return "effect-text"
  }

  if (id.includes("/packages/effect-search/") || id.includes("/node_modules/effect-search/")) {
    return "effect-search"
  }

  if (id.includes("/packages/effect-math/") || id.includes("/node_modules/effect-math/")) {
    return "effect-math"
  }

  if (id.includes("/node_modules/@base-ui-components/") || id.includes("/node_modules/@heroicons/")) {
    return "ui-vendor"
  }

  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: manualChunkNameFor
      }
    }
  },
  server: {
    port: vitePort,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true
      }
    }
  }
})
