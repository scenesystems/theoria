import { Context, Data, Effect, Layer, Schema } from "effect"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"

import type { Program } from "../../contracts/presentation.js"
import { ProgramSourcesJson, runtimeDataPathnames } from "../config/runtime-data.js"
import { StaticStore } from "../config/static-store.js"
import { multiFileProgram, programFile } from "./presentation.js"

/**
 * Source files each demo publishes as its readable program, as paths relative
 * to `apps/theoria/app/`. The first entry is the runnable server program.
 *
 * This table is the single source of truth for both the build-time generator
 * (`scripts/generate-runtime-data.ts`) and the runtime `ProgramSources`
 * service, so a demo's program never depends on filesystem access.
 */
export const ProgramDemoId = Schema.Literal(
  "effect-text",
  "effect-search",
  "effect-math",
  "effect-dsp",
  "digest",
  "sign",
  "seal"
)

export type ProgramDemoId = typeof ProgramDemoId.Type

export const programDemoIds: ReadonlyArray<ProgramDemoId> = ProgramDemoId.literals

export const programSourceFiles: Record<ProgramDemoId, Arr.NonEmptyReadonlyArray<string>> = {
  "effect-text": [
    "server/demos/effect-text/run.ts",
    "server/demos/effect-text/package-story.ts",
    "web/text/browserTextLayout.ts",
    "web/view/text/authority.ts",
    "web/atoms/text.ts",
    "web/atoms/reflow.ts"
  ],
  "effect-search": [
    "server/demos/effect-search/run.ts",
    "contracts/demo/objective.ts",
    "web/atoms/optimization-animation.ts"
  ],
  "effect-math": [
    "server/demos/effect-math/run.ts",
    "contracts/demo/power.ts",
    "web/atoms/power-animation.ts"
  ],
  "effect-dsp": ["server/demos/effect-dsp/run.ts", "contracts/demo/dsp.ts"],
  digest: ["server/demos/digest/run.ts"],
  sign: ["server/demos/sign/run.ts"],
  seal: ["server/demos/seal/run.ts"]
}

/** Every app-relative source path referenced by any demo, deduplicated. */
export const allProgramSourcePaths: ReadonlyArray<string> = Arr.dedupe(
  Arr.flatMap(programDemoIds, (id) => programSourceFiles[id])
)

const demoSourcePattern = /^server\/demos\/[^/]+\/(.+)$/u

/**
 * Entry shown to readers for an app-relative source path: a demo's own files
 * collapse to `server/<file>`; shared contract and web files keep their path.
 */
export const programEntryForPath = (appPath: string): string => {
  const matches = demoSourcePattern.exec(appPath)

  return matches === null ? appPath : `server/${matches[1]}`
}

export const programEntriesForDemo = (id: ProgramDemoId): ReadonlyArray<string> =>
  Arr.map(programSourceFiles[id], programEntryForPath)

export class ProgramSourceReadError extends Data.TaggedError("ProgramSourceReadError")<{
  readonly entry: string
  readonly reason: string
}> {}

export class ProgramSources extends Context.Tag("@theoria/app/server/demos/ProgramSources")<
  ProgramSources,
  {
    readonly program: (id: ProgramDemoId) => Effect.Effect<Program, ProgramSourceReadError>
  }
>() {}

/** Builds a demo's program from a complete `appPath → source` table. */
export const programFromSources = (
  id: ProgramDemoId,
  sources: Record<string, string>
): Effect.Effect<Program, ProgramSourceReadError> =>
  Effect.forEach(programSourceFiles[id], (appPath) =>
    EffectRecord.get(sources, appPath).pipe(
      Effect.mapBoth({
        onFailure: () => new ProgramSourceReadError({ entry: appPath, reason: "Source missing from program sources." }),
        onSuccess: (source) => programFile(programEntryForPath(appPath), source)
      })
    )).pipe(
      Effect.flatMap((files) =>
        Arr.isNonEmptyReadonlyArray(files)
          ? Effect.succeed(multiFileProgram(files))
          : Effect.fail(new ProgramSourceReadError({ entry: id, reason: "Demo publishes no source files." }))
      )
    )

const makeProgramSources = Effect.gen(function*() {
  const store = yield* StaticStore
  const sources = yield* store.text(runtimeDataPathnames.programSources).pipe(
    Effect.flatMap(Schema.decode(ProgramSourcesJson)),
    Effect.mapError((cause) =>
      new ProgramSourceReadError({ entry: runtimeDataPathnames.programSources, reason: String(cause) })
    ),
    Effect.cached
  )

  return ProgramSources.of({
    program: (id) => Effect.flatMap(sources, (table) => programFromSources(id, table))
  })
})

export const ProgramSourcesLive: Layer.Layer<ProgramSources, never, StaticStore> = Layer.effect(
  ProgramSources,
  makeProgramSources
)

/** Convenience accessor used by demo modules. */
export const programForDemo = (id: ProgramDemoId): Effect.Effect<Program, ProgramSourceReadError, ProgramSources> =>
  Effect.flatMap(ProgramSources, (service) => service.program(id))
