import type { Worker } from "@effect/platform"
import { BrowserWorker } from "@effect/platform-browser"
import type { Layer } from "effect"

import SearchWorker from "../place-search.worker.js?worker"

/**
 * Spawns the arrangement search's Web Worker (`place-search.worker.ts`).
 * Vite's `?worker` import bundles that program root as its own entry and
 * gives back its constructor, so the worker's URL is never written down here.
 * Nothing is spawned until a `Worker.makeSerialized` asks.
 *
 * @since 0.3.0
 */
export const layer: Layer.Layer<Worker.WorkerManager | Worker.Spawner> = BrowserWorker.layer(() => new SearchWorker())
