import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect } from "effect"

import { SearchConfig } from "../../../contracts/capability/effect-search.js"
import { effectSearchEntryDescriptor } from "../../../contracts/entry/descriptors/effect-search.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import type { RunData } from "../../../contracts/study/run.js"

import { preloadProgram } from "./preload.js"
import { runSections, runSummary, streamElements, streamPlan, streamSections } from "./stream.js"

export { preloadProgram, runSummary, streamElements, streamPlan, streamSections }

const runIdentity = EntryRunIdentity.project(effectSearchEntryDescriptor)

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const runnableProgram = yield* preloadProgram
  const sections = yield* runSections(SearchConfig.defaults())

  const endedAt = yield* Clock.currentTimeMillis

  return {
    ...runIdentity,
    summary: runSummary,
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections
  }
})
