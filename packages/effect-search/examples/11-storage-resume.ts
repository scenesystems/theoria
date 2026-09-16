/**
 * Persists optimization checkpoints and trials to file-backed storage, then
 * resumes from that stored state.
 *
 * Run: bun run examples/11-storage-resume.ts
 */
import { FileSystem } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Match, Number as Num } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, OptimizationStorage, Sampler, SearchSpace } from "@scenesystems/effect-search"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const objectiveValue = (x: number, y: number): number =>
  Num.sum(Numeric.pow(Num.subtract(x, 0.4), 2), Numeric.pow(Num.subtract(y, 1.2), 2))

const program = Effect.scoped(
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const directory = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "effect-search-storage-resume-"
    })
    const storageLayer = OptimizationStorage.layerFileSystem(StudyStorage.fileSystemOptions(directory))

    const space = yield* SearchSpace.make({
      x: SearchSpace.float(-3, 3),
      y: SearchSpace.float(-3, 3)
    })

    const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(objectiveValue(config.x, config.y))

    yield* Optimization.minimize({
      space,
      sampler: Sampler.tpe({ seed: 901 }),
      trials: 15,
      objective
    }).pipe(Effect.provide(storageLayer))

    const resumed = yield* Optimization.resumeFromStorage({
      space,
      sampler: Sampler.tpe({ seed: 901 }),
      direction: "minimize",
      trials: 10,
      objective
    }).pipe(Effect.provide(storageLayer))

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
