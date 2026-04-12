import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import { dspRunSummary } from "../../../contracts/capability/effect-dsp-runtime-presentation.js"
import { DspRunRequest } from "../../../contracts/capability/effect-dsp.js"
import { effectDspEntryDescriptor } from "../../../contracts/entry/descriptors/effect-dsp.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { RunData } from "../../../contracts/study/run.js"
import { type DemoStreamPlan, phaseFromElementStream } from "../../kernel/kinds/stream-plan.js"

import { type DspProviderRuntime, DspProviderRuntimeLive } from "../../capability/effect-dsp.js"
import type { StreamElement } from "../../kernel/kinds/stream-element.js"
import { multiFileProgram } from "../../kernel/presentation.js"
import { executableProgramFile, type ProgramSourceReadError } from "../../kernel/program-source.js"
import { dspExecutionStory, requestFromManifest } from "./runtime.js"
import { buildDspStageStories } from "./stage-story.js"
import { stageStream } from "./stream-support.js"
import { streamElementsForRequest, streamSections } from "./stream.js"

const effectDspRunIdentity = EntryRunIdentity.project(effectDspEntryDescriptor)

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

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const run: Effect.Effect<RunData, unknown, DspProviderRuntime | FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const runnableProgram = yield* preloadProgram
    const sections = yield* Stream.runCollect(streamSections(DspRunRequest.defaults())).pipe(
      Effect.map(Arr.fromIterable)
    )
    const endedAt = yield* Clock.currentTimeMillis

    return {
      ...effectDspRunIdentity,
      summary: dspRunSummary,
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
    Effect.map((story) => ({
      packageName: effectDspRunIdentity.packageName,
      program: preloadProgram,
      summary: dspRunSummary,
      phases: buildDspStageStories(story).map(({ stageId, steps, sectionEffects }) =>
        phaseFromElementStream(stageId, stageStream({ stageId, steps, sectionEffects }))
      )
    }))
  )
