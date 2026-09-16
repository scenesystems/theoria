/**
 * Persists study events to the package's file-backed storage service and
 * resumes the study from that stored state.
 *
 * Run: bun run examples/11-storage-resume.ts
 */
import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Layer, Match, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { ArtifactContext, ArtifactSink, Sampler, SearchSpace, Study, StudyStorage } from "@scenesystems/effect-search"
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"

const objectiveValue = (x: number, y: number): number => Numeric.pow(x - 0.4, 2) + Numeric.pow(y - 1.2, 2)

const program = Effect.scoped(
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directory = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "effect-search-storage-resume-"
    })
    const runId = yield* Schema.decode(StudyArtifact.RunId)("01HZ0000000000000000000000")
    const packageVersion = yield* Schema.decode(StudyArtifact.PackageVersion)("0.1.0")
    const envelopeContextLayer = ArtifactContext.layer(
      new ArtifactContext.Options({
        packageVersion,
        runId,
        studyId: "example-study"
      })
    )
    const artifactSinkLayer = ArtifactSink.layerFileSystem(directory)
    const studyLayer = StudyStorage.layer(
      new StudyStorage.Options({
        directory,
        fileName: "envelopes.jsonl"
      })
    ).pipe(
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
          totalTrials: Iterable.size(trials)
        })),
      Match.tag("MultiObjective", () => Effect.void),
      Match.exhaustive
    )
  })
)

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
