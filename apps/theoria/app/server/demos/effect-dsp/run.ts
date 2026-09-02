import { Clock, Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import type { Program } from "../../../contracts/presentation.js"
import type { RunData } from "../../../contracts/run.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"

import { programForDemo, type ProgramSourceReadError, type ProgramSources } from "../program-sources.js"
import type { StreamElement } from "../stream-element.js"
import { DspProviderRuntime, type DspProviderRuntimeApi } from "./provider.js"
import { defaultDspRunRequest, requestFromManifest } from "./runtime.js"
import { streamElementsForRequest, streamSections } from "./stream.js"

// ---------------------------------------------------------------------------
// Preload
// ---------------------------------------------------------------------------

export const preloadProgram: Effect.Effect<Program, ProgramSourceReadError, ProgramSources> = programForDemo(
  "effect-dsp"
)

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const run: Effect.Effect<RunData, unknown, DspProviderRuntime | ProgramSources> = Effect.gen(
  function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const runnableProgram = yield* preloadProgram
    const runtime = yield* DspProviderRuntime
    const sections = yield* Stream.runCollect(streamSections(defaultDspRunRequest)).pipe(
      Effect.tapError(() => runtime.markDegraded),
      Effect.tap(() => runtime.markOperational),
      Effect.map(Arr.fromIterable)
    )
    const endedAt = yield* Clock.currentTimeMillis

    return {
      id: "effect-dsp",
      packageName: "@scenesystems/effect-dsp",
      summary:
        "effect-dsp froze the approved DSP manifest, evaluated a typed module, optimized demonstrations, and re-evaluated the same scenario under shared runtime authority.",
      durationMs: endedAt - startedAt,
      program: runnableProgram,
      sections
    }
  }
)

export const streamElements = (
  manifest: StreamManifest | null,
  runtime: DspProviderRuntimeApi
): Stream.Stream<StreamElement, unknown, never> =>
  streamElementsForRequest(requestFromManifest(manifest)).pipe(
    Stream.provideService(DspProviderRuntime, runtime)
  )
