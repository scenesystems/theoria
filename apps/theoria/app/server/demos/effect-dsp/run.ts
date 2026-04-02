import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import type { Program } from "../../../contracts/presentation.js"
import type { RunData } from "../../../contracts/run.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"

import { multiFileProgram } from "../presentation.js"
import { executableProgramFile, type ProgramSourceReadError } from "../program-source.js"
import type { StreamElement } from "../stream-element.js"
import { type DspProviderRuntime, DspProviderRuntimeLive } from "./provider.js"
import { defaultDspRunRequest, requestFromManifest } from "./runtime.js"
import { streamElementsForRequest, streamSections } from "./stream.js"

// ---------------------------------------------------------------------------
// Preload
// ---------------------------------------------------------------------------

export const preloadProgram: Effect.Effect<
  Program,
  ProgramSourceReadError,
  FileSystem.FileSystem | Path.Path
> = Effect.all([
  executableProgramFile(new URL("./run.ts", import.meta.url).href),
  executableProgramFile(new URL("../../../contracts/demo/dsp.ts", import.meta.url).href)
]).pipe(Effect.map(([serverFile, contractFile]) => multiFileProgram([serverFile, contractFile])))

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const run: Effect.Effect<RunData, unknown, DspProviderRuntime | FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const runnableProgram = yield* preloadProgram
    const sections = yield* Stream.runCollect(streamSections(defaultDspRunRequest)).pipe(
      Effect.map(Arr.fromIterable)
    )
    const endedAt = yield* Clock.currentTimeMillis

    return {
      id: "effect-dsp",
      packageName: "effect-dsp",
      summary:
        "effect-dsp froze the approved DSP manifest, evaluated a typed module, optimized demonstrations, and re-evaluated the same scenario under shared runtime authority.",
      durationMs: endedAt - startedAt,
      program: runnableProgram,
      sections
    }
  }
)

export const streamElements = (manifest: StreamManifest | null): Stream.Stream<StreamElement, unknown, never> =>
  streamElementsForRequest(requestFromManifest(manifest)).pipe(
    Stream.provideLayer(DspProviderRuntimeLive)
  )
