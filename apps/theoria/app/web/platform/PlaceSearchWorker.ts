import type { Worker as PlatformWorker } from "@effect/platform"
import { BrowserWorker } from "@effect/platform-browser"
import type { Layer } from "effect"

/**
 * Spawns the arrangement search's Web Worker (`place-search.worker.ts`).
 * The entry is named the standard way — a module-relative URL against
 * `import.meta.url` — which every bundler resolves at build time into its
 * own chunk, so nothing here is particular to one of them. Nothing is
 * spawned until a `Worker.makeSerialized` asks.
 *
 * @since 0.3.0
 */
export const layer: Layer.Layer<PlatformWorker.WorkerManager | PlatformWorker.Spawner> = BrowserWorker.layer(() =>
  new Worker(new URL("../place-search.worker.ts", import.meta.url), { type: "module" })
)
