// eslint-disable-next-line no-restricted-imports -- Vite plugin runs in Node/Bun build context, not app code
import { execSync } from "node:child_process"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"

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

const textTokens = (): Plugin => ({
  name: "theoria:text-tokens",
  buildStart() {
    execSync("bun scripts/generate-text-tokens.ts", { cwd: import.meta.dirname })
  },
  handleHotUpdate({ file }) {
    if (file.endsWith("contracts/presentation/text.ts")) {
      execSync("bun scripts/generate-text-tokens.ts", { cwd: import.meta.dirname })
    }
  }
})

export default defineConfig({
  plugins: [textTokens(), react({ include: /\/app\/.*\.[tj]sx?$/u }), tailwindcss()],
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
