/**
 * Persists study events to the package's file-backed storage service and
 * resumes the study from that stored state.
 *
 * Run: bun run examples/11-storage-resume.ts
 */
import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, Match, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Contracts, Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const objectiveValue = (x: number, y: number): number => Numeric.pow(x - 0.4, 2) + Numeric.pow(y - 1.2, 2)

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
    const artifactSinkLayer = Contracts.fileSystemSink(directory)
    const studyLayer = Study.StudyStorageLive(Study.studyStorageOptions(directory)).pipe(
      Layer.provideMerge(Layer.merge(artifactSinkLayer, envelopeContextLayer))
    )

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
    }).pipe(Effect.provide(studyLayer))

    const resumed = yield* Study.resumeFromStorage({
      space,
      sampler: Sampler.tpe({ seed: 901 }),
      direction: "minimize",
      trials: 10,
      objective
    }).pipe(Effect.provide(studyLayer))

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
