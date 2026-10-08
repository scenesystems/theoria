import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"
import { Array as Arr, Effect, FileSystem, Layer, Number as Num, Option, Struct } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as OptimizationStorage from "../../src/OptimizationStorage.js"
import * as Sampler from "../../src/Sampler.js"
import {
  encodeSnapshotConfigTrace,
  encodeSnapshotValueTrace,
  snapshotConfigTrace,
  snapshotSingleObjective,
  snapshotSingleObjectiveResult,
  snapshotSpace,
  snapshotValueTrace
} from "../helpers/optimizationSnapshots.js"

const totalTrials = 10
const checkpointTrials = 5
const crashedTrials = 3
const recoveredTrials = 2

/**
 * Genuine crash boundary: a five-trial run writes its own snapshot, a resumed run journals
 * trials 5–7 and dies before its next snapshot write, then a second resume runs trials 8–9.
 * The recovered trajectory must equal the uninterrupted run with the same sampler options.
 */
const crashRecoveredTrajectory = (samplerFor: () => Sampler.Sampler) =>
  Effect.gen(function*() {
    const space = yield* snapshotSpace
    const fileSystem = yield* FileSystem.FileSystem
    const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-search-journal-rng-recovery-" })
    const storageOptions = StudyStorage.fileSystemOptions(directory)
    const storage = yield* OptimizationStorage.makeFileSystem(storageOptions)
    const crashBeforeSnapshot = Layer.effect(
      OptimizationStorage.OptimizationStorage,
      OptimizationStorage.makeFileSystem(storageOptions).pipe(
        Effect.map((service) => Struct.assign(service, { writeSnapshot: () => Effect.void }))
      )
    )
    const resumeOptions = (trials: number) =>
      new Optimization.StorageResumeOptions({
        space,
        sampler: samplerFor(),
        direction: "minimize",
        trials,
        objective: snapshotSingleObjective
      })

    const baseline = yield* Optimization.run(
      new Optimization.FlatOptions({
        space,
        sampler: samplerFor(),
        direction: "minimize",
        trials: totalTrials,
        objective: snapshotSingleObjective
      })
    ).pipe(Effect.flatMap((result) => Effect.fromOption(snapshotSingleObjectiveResult(result))))

    yield* Optimization.run(
      new Optimization.FlatOptions({
        space,
        sampler: samplerFor(),
        direction: "minimize",
        trials: checkpointTrials,
        objective: snapshotSingleObjective
      })
    ).pipe(Effect.provide(OptimizationStorage.layerFileSystem(storageOptions)))
    yield* Optimization.resumeFromStorage(resumeOptions(crashedTrials)).pipe(Effect.provide(crashBeforeSnapshot))

    const durableSnapshot = yield* storage.loadSnapshot().pipe(Effect.flatMap(Effect.fromOption))
    expect(durableSnapshot.nextTrialNumber).toBe(checkpointTrials)
    expect(Arr.length(durableSnapshot.trials)).toBe(checkpointTrials)
    expect(Arr.length(yield* storage.loadTrialLog())).toBe(Num.sum(checkpointTrials, crashedTrials))
    expect(Arr.length(yield* storage.replayTrialLog())).toBe(crashedTrials)

    const recovered = yield* Optimization.resumeFromStorage(resumeOptions(recoveredTrials)).pipe(
      Effect.provide(OptimizationStorage.layerFileSystem(storageOptions)),
      Effect.flatMap((result) => Effect.fromOption(snapshotSingleObjectiveResult(result)))
    )

    expect(Arr.map(Arr.fromIterable(recovered.trials), (trial) => trial.trialNumber)).toEqual(
      Arr.makeBy(totalTrials, (index) => index)
    )
    expect(encodeSnapshotConfigTrace(yield* snapshotConfigTrace(recovered))).toBe(
      encodeSnapshotConfigTrace(yield* snapshotConfigTrace(baseline))
    )
    expect(encodeSnapshotValueTrace(snapshotValueTrace(recovered))).toBe(
      encodeSnapshotValueTrace(snapshotValueTrace(baseline))
    )
    expect(Option.map(yield* storage.loadSnapshot(), (snapshot) => snapshot.nextTrialNumber)).toEqual(
      Option.some(totalTrials)
    )
  }).pipe(Effect.scoped, Effect.provide(BunServices.layer))

describe("journal-tail recovery advances sampler streams per durable trial", () => {
  it.effect("Random continues after journaled trials 5–7 instead of repeating trials 5–6", () =>
    crashRecoveredTrajectory(() => Sampler.random({ seed: 5519 })))

  it.effect("TPE startup continues after journaled trials 5–7 instead of repeating trials 5–6", () =>
    crashRecoveredTrajectory(() => Sampler.tpe(new Sampler.TpeOptions({ seed: 5519, nStartupTrials: 20 }))))

  it.effect("TPE model phase continues after journaled trials 5–7", () =>
    crashRecoveredTrajectory(() => Sampler.tpe(new Sampler.TpeOptions({ seed: 5519, nStartupTrials: 3 }))))
})
