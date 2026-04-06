/**
 * COPRO snapshot-resume contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Ref, Schema } from "effect"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import * as Optimizer from "effect-dsp/Optimizer"
import {
  firstLegResponses,
  fullRunResponses,
  makeQaSignature,
  makeSequenceLayer,
  makeTrainset,
  prepareStructuredModule,
  resumeTailResponses
} from "../helpers/copro.js"
import { CoproProgressionFixtureSchema, CoproResumeFixtureSchema, loadFixture } from "../helpers/dspy-fixtures/index.js"

describe("Optimizer.copro resume", () => {
  it.effect("resumes interrupted runs without changing deterministic outcome", () =>
    Effect.gen(function*() {
      const rawProgressionFixture = yield* loadFixture("dspy.copro.progression.basic")
      const progressionFixture = yield* Schema.decodeUnknown(CoproProgressionFixtureSchema)(rawProgressionFixture)
      const rawResumeFixture = yield* loadFixture("dspy.copro.resume.seed-17")
      const resumeFixture = yield* Schema.decodeUnknown(CoproResumeFixtureSchema)(rawResumeFixture)
      const signature = yield* makeQaSignature()
      const baselineModule = yield* Module.predict("qa-baseline", signature)
      const partialModule = yield* Module.predict("qa-partial", signature)
      const resumedModule = yield* Module.predict("qa-resumed", signature)

      yield* prepareStructuredModule(baselineModule)
      yield* prepareStructuredModule(partialModule)
      yield* prepareStructuredModule(resumedModule)

      yield* Optimizer.copro({
        module: baselineModule,
        trainset: makeTrainset(),
        metric: Metric.exactMatch("answer"),
        numCandidates: progressionFixture.payload.numCandidates,
        maxSteps: progressionFixture.payload.maxSteps,
        seed: progressionFixture.payload.seed
      }).pipe(Effect.provide(makeSequenceLayer(fullRunResponses())))

      const snapshotRef = yield* Ref.make(Option.none<Optimizer.COPROSnapshot>())
      yield* Optimizer.copro({
        module: partialModule,
        trainset: makeTrainset(),
        metric: Metric.exactMatch("answer"),
        numCandidates: progressionFixture.payload.numCandidates,
        maxSteps: resumeFixture.payload.expectedNextStep,
        seed: progressionFixture.payload.seed,
        snapshotSink: (snapshot) => Ref.set(snapshotRef, Option.some(snapshot))
      }).pipe(Effect.provide(makeSequenceLayer(firstLegResponses())))

      const snapshotOption = yield* Ref.get(snapshotRef)

      expect(Option.isSome(snapshotOption)).toBe(true)

      if (Option.isNone(snapshotOption)) {
        return
      }

      yield* Optimizer.copro({
        module: resumedModule,
        trainset: makeTrainset(),
        metric: Metric.exactMatch("answer"),
        numCandidates: progressionFixture.payload.numCandidates,
        maxSteps: progressionFixture.payload.maxSteps,
        seed: progressionFixture.payload.seed,
        resumeFrom: new Optimizer.COPROSnapshot({
          ...snapshotOption.value,
          moduleName: "qa-resumed",
          moduleState: new Module.SavedState({
            version: snapshotOption.value.moduleState.version,
            modules: snapshotOption.value.moduleState.modules.map((entry) => ({
              name: "qa-resumed",
              params: entry.params
            }))
          })
        })
      }).pipe(Effect.provide(makeSequenceLayer(resumeTailResponses())))

      const baselineState = yield* Module.save(baselineModule)
      const resumedState = yield* Module.save(resumedModule)

      expect(snapshotOption.value.nextStep).toBe(resumeFixture.payload.expectedNextStep)
      expect(snapshotOption.value.bestInstruction).toBe(resumeFixture.payload.expectedBestInstruction)
      expect(baselineState.modules.map((entry) => entry.params)).toEqual(
        resumedState.modules.map((entry) => entry.params)
      )
    }))
})
