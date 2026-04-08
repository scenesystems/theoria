import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import type { StreamManifest } from "../../../contracts/evidence/manifest.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { RunData } from "../../../contracts/study/run.js"
import { type DemoStreamPlan, makeStreamPlan, phaseFromElementStream } from "../../kernel/kinds/stream-plan.js"

import { type DspProviderRuntime, DspProviderRuntimeLive } from "../../capability/effect-dsp.js"
import type { StreamElement } from "../../kernel/kinds/stream-element.js"
import { multiFileProgram } from "../../kernel/presentation.js"
import { executableProgramFile, type ProgramSourceReadError } from "../../kernel/program-source.js"
import { defaultDspRunRequest, dspExecutionStory, requestFromManifest } from "./runtime.js"
import { buildDspStageStories } from "./stage-story.js"
import { stageStream } from "./stream-support.js"
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
  executableProgramFile(new URL("../../../contracts/capability/effect-dsp.ts", import.meta.url).href)
]).pipe(Effect.map(([serverFile, contractFile]) => multiFileProgram([serverFile, contractFile])))

export const runSummary =
  "effect-dsp froze the approved DSP manifest, evaluated a typed module, optimized demonstrations, and re-evaluated the same scenario under shared runtime authority."

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
      summary: runSummary,
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

export const streamPlan = (
  manifest: StreamManifest | null
): Effect.Effect<
  DemoStreamPlan<DspProviderRuntime | FileSystem.FileSystem | Path.Path, unknown>,
  unknown,
  DspProviderRuntime
> =>
  dspExecutionStory(requestFromManifest(manifest)).pipe(
    Effect.map((story) =>
      makeStreamPlan({
        packageName: "effect-dsp",
        program: preloadProgram,
        summary: runSummary,
        phases: buildDspStageStories(story).map(({ stageId, steps, sectionEffects }) =>
          phaseFromElementStream(stageId, stageStream({ stageId, steps, sectionEffects }))
        )
      })
    )
  )
