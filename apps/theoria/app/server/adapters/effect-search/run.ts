import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { effectSearchEntryDescriptor } from "../../../contracts/entry/descriptors/effect-search.js"
import { entryRunIdentityForId } from "../../../contracts/entry/routing.js"
import type { RunData } from "../../../contracts/study/run.js"

import { preloadProgram } from "./preload.js"
import {
  defaultEffectSearchStreamRequest,
  runSections,
  runSummary,
  streamElements,
  streamPlan,
  streamSections
} from "./stream.js"

export { preloadProgram, runSummary, streamElements, streamPlan, streamSections }

const effectSearchRunIdentity = entryRunIdentityForId(effectSearchEntryDescriptor.entryId)

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const runnableProgram = yield* preloadProgram
  const sections = yield* runSections(defaultEffectSearchStreamRequest)

  const endedAt = yield* Clock.currentTimeMillis

  return {
    ...effectSearchRunIdentity,
    summary: runSummary,
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections
  }
})
