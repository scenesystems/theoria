/**
 * Storage Resume — crash-safe persistence with append-only envelope log.
 *
 * Real use case: restart a worker and continue from on-disk study state.
 *
 * What this shows: using StudyStorage for crash-safe on-disk persistence and resume from storage.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/11-storage-resume.ts
 */
import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, Match, Schema } from "effect"

import { Contracts, Sampler, SearchSpace, Study } from "effect-search"

const objectiveValue = (x: number, y: number): number => (x - 0.4) ** 2 + (y - 1.2) ** 2

const NoopArtifactSink = Layer.succeed(Contracts.ArtifactSink, { emit: () => Effect.void })

const program = Effect.scoped(
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directory = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "effect-search-storage-resume-"
    })
    const runId = yield* Schema.decode(Contracts.RunId)("01HZ0000000000000000000000")
    const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.1.0")
    const envelopeContextLayer = Contracts.EnvelopeContextLive({
      packageVersion,
      runId,
      studyId: "example-study"
    })
    const storageLayer = Study.StudyStorageLive(Study.studyStorageOptions(directory))

    const space = yield* SearchSpace.make({
      x: SearchSpace.float(-3, 3),
      y: SearchSpace.float(-3, 3)
    })

    const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(objectiveValue(config.x, config.y))

    yield* Study.minimize({
      space,
      sampler: Sampler.tpe({ seed: 901 }),
      trials: 15,
      objective
    }).pipe(Effect.provide(storageLayer), Effect.provide(NoopArtifactSink), Effect.provide(envelopeContextLayer))

    const resumed = yield* Study.resumeFromStorage({
      space,
      sampler: Sampler.tpe({ seed: 901 }),
      direction: "minimize",
      trials: 10,
      objective
    }).pipe(Effect.provide(storageLayer), Effect.provide(NoopArtifactSink), Effect.provide(envelopeContextLayer))

    yield* Match.value(resumed).pipe(
      Match.tag("SingleObjective", ({ bestTrial, completionReason, trials }) =>
        Effect.log("Storage resume complete", {
          storageDirectory: directory,
          completionReason,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config,
          totalTrials: trials.length
        })),
      Match.tag("MultiObjective", () => Effect.void),
      Match.exhaustive
    )
  })
)

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
