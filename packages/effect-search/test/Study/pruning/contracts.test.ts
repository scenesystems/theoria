import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Ref, Schedule, Stream } from "effect"

import { decodeSlotConfig } from "../../../src/experimental/scenarios/slot.js"
import * as Study from "../../../src/Study/index.js"
import * as Trial from "../../../src/Trial/index.js"
import {
  asSingleObjective,
  deterministicSampler,
  objectiveWithInvalidReports,
  objectiveWithReports,
  objectiveWithStopProbe,
  pruneLowSlotPolicy,
  pruningSpace,
  reportFailureReasons
} from "./helpers.js"

describe("Study pruning and early stop contracts", () => {
  it.effect("marks pruned trials with typed metadata and excludes them from best selection", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: pruningSpace,
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 4,
        pruningPolicy: pruneLowSlotPolicy,
        objective: objectiveWithReports
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const trialTags = result.trials.map((trial) => trial.state._tag)

      expect(trialTags).toEqual(["Pruned", "Pruned", "Completed", "Completed"])
      expect(result.bestTrial.trialNumber).toBe(2)
      expect(result.bestTrial.state.value).toBe(2)

      const firstPruned = result.trials[0]
      if (firstPruned && Trial.isState("Pruned")(firstPruned.state)) {
        expect(firstPruned.state.step).toBe(0)
        expect(firstPruned.state.reason).toBe("slot-below-two")
        expect(firstPruned.state.policy).toBe("slot-pruner")
      }
    }))

  it.effect("surfaces invalid report semantics through typed InvalidObjectiveReport failures", () =>
    Effect.gen(function*() {
      const optimized = yield* Study.optimize({
        space: pruningSpace,
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 4,
        retrySchedule: Schedule.recurs(0),
        objective: objectiveWithInvalidReports
      })

      const resultOption = asSingleObjective(optimized)
      expect(Option.isSome(resultOption)).toBe(true)

      if (Option.isNone(resultOption)) {
        return
      }

      const result = resultOption.value
      const reasons = reportFailureReasons(result.trials)

      expect(reasons).toHaveLength(3)
      expect(reasons).toContain("duplicate-step")
      expect(reasons).toContain("non-monotone-step")
      expect(reasons).toContain("value must be finite")
      expect(result.bestTrial.trialNumber).toBe(3)
    }))

  it.effect("honors Drain and Interrupt stop modes with deterministic heartbeat semantics", () =>
    Effect.gen(function*() {
      const drainHeartbeatRef = yield* Ref.make<ReadonlyArray<string>>([])
      const interruptHeartbeatRef = yield* Ref.make<ReadonlyArray<string>>([])

      const drainResult = yield* Study.optimize({
        space: pruningSpace,
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 3,
        stopMode: "Drain",
        objective: objectiveWithStopProbe(drainHeartbeatRef, "drain-stop")
      })
      const interruptResult = yield* Study.optimize({
        space: pruningSpace,
        sampler: deterministicSampler,
        direction: "minimize",
        trials: 3,
        stopMode: "Interrupt",
        objective: objectiveWithStopProbe(interruptHeartbeatRef, "interrupt-stop")
      })

      const drainOption = asSingleObjective(drainResult)
      const interruptOption = asSingleObjective(interruptResult)
      expect(Option.isSome(drainOption)).toBe(true)
      expect(Option.isSome(interruptOption)).toBe(true)

      if (Option.isNone(drainOption) || Option.isNone(interruptOption)) {
        return
      }

      expect(drainOption.value.completionReason).toBe("interrupted")
      expect(interruptOption.value.completionReason).toBe("interrupted")
      expect(drainOption.value.trials).toHaveLength(1)
      expect(interruptOption.value.trials).toHaveLength(1)

      expect(yield* Ref.get(drainHeartbeatRef)).toEqual(["Continue"])
      expect(yield* Ref.get(interruptHeartbeatRef)).toEqual(["Stop"])
    }))

  it.effect("emits pruning and stop lifecycle events for semantic replay assertions", () =>
    Effect.gen(function*() {
      const events = yield* Stream.runCollect(
        Study.optimizeStream({
          space: pruningSpace,
          sampler: deterministicSampler,
          direction: "minimize",
          trials: 3,
          stopMode: "Drain",
          pruningPolicy: {
            name: "always-prune",
            decide: ({ latestReport }) =>
              Study.PruneTrialDecision({
                step: latestReport.step,
                reason: "always",
                policy: "always-prune"
              })
          },
          objective: (raw, runtime) =>
            Effect.gen(function*() {
              const config = decodeSlotConfig(raw)
              yield* runtime.report(0, config.slot)
              yield* runtime.requestStop("stream-stop")
              return config.slot
            })
        })
      )

      const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)

      expect(tags).toContain("TrialReported")
      expect(tags).toContain("TrialPruned")
      expect(tags).toContain("StudyStopRequested")
      expect(tags[tags.length - 1]).toBe("StudyCompleted")
    }))
})
