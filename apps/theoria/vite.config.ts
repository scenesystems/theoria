import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite"

const apiPort = process.env.THEORIA_PORT ?? "3876"
const vitePort = 5175

/**
 * The faces the shell preloads: the Latin subsets of the two served
 * typefaces, which set the text of the first render. The stylesheet declares
 * them from the Fontsource packages (`app/web/styles.css`) and the build
 * emits them as content-hashed assets, so the preload links are written from
 * the bundle rather than by hand: the stylesheet's URL and the preload's are
 * the same file, and a version bump moves both.
 */
const preloadedFaces = ["figtree-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2"]

const isTypeface = (fileName: string): boolean => fileName.endsWith(".woff2")

const preloadTag = (href: string): HtmlTagDescriptor => ({
  tag: "link",
  attrs: { rel: "preload", href, as: "font", type: "font/woff2", crossorigin: true },
  injectTo: "head"
})

const preloadTypefaces = (): Plugin => ({
  name: "theoria:preload-typefaces",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (_html, context) => {
      const emitted = Object.values(context.bundle ?? {})
      return preloadedFaces.map((face) => {
        const asset = emitted.find((output) =>
          output.type === "asset" && output.originalFileNames.some((original) => original.endsWith(`/${face}`))
        )
        if (asset === undefined) {
          throw new Error(`The build emitted no asset for the preloaded face ${face}; is it still declared?`)
        }
        return preloadTag(`/${asset.fileName}`)
      })
    }
  }
})

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
  plugins: [react(), tailwindcss(), preloadTypefaces()],
  build: {
    outDir: "dist",
    sourcemap: false,
    // A typeface is never inlined into the stylesheet: a small subset as a data URL would weigh on every
    // page's render-blocking CSS to save a request made only when one of its glyphs is shown.
    assetsInlineLimit: (fileName) => isTypeface(fileName) ? false : undefined,
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
