import { expect, it } from "@effect/vitest"
import * as History from "@scenesystems/effect-study/History"
import { Array as Arr, Effect, Equal, Ref, Schedule } from "effect"

import { contextForSuggestion } from "../../../src/internal/optimization/runtime/context.js"
import * as Objective from "../../../src/Objective.js"
import * as Optimization from "../../../src/Optimization.js"
import * as Pruning from "../../../src/Pruning.js"
import * as Sampler from "../../../src/Sampler.js"
import * as SearchSpace from "../../../src/SearchSpace.js"
import * as Trial from "../../../src/Trial.js"

it.effect("preserves pruned reports separately from completed objectives and excludes failures", () =>
  Effect.gen(function*() {
    const contexts = yield* Ref.make(Arr.empty<Sampler.Context>())
    const random = Sampler.random({ seed: 0 })
    const sampler = new Sampler.Sampler({
      kind: random.kind,
      pendingImputationPolicy: random.pendingImputationPolicy,
      checkpoint: random.checkpoint,
      restore: random.restore,
      suggest: (_space, context) =>
        Ref.update(contexts, (all) => Arr.append(all, context)).pipe(
          Effect.as({ x: context.nextTrialNumber })
        )
    })
    yield* Optimization.run(
      new Optimization.FlatOptions({
        space: yield* SearchSpace.make({ x: SearchSpace.int(0, 3) }),
        sampler,
        direction: "maximize",
        trials: 4,
        retrySchedule: Schedule.recurs(0),
        pruningPolicy: new Pruning.Policy({
          name: "first-only",
          decide: ({ trialNumber, latestReport }) =>
            Equal.equals(trialNumber, 0)
              ? Pruning.prune({ step: latestReport.step, reason: "test", policy: "first-only" })
              : Pruning.continueEvaluation()
        }),
        objective: (config, runtime) =>
          Effect.gen(function*() {
            yield* runtime.report(3, 0.4)
            yield* runtime.report(1, 0.9)
            if (Equal.equals(config.x, 1)) return yield* Effect.fail("failed trial")
            return 100
          })
      })
    )
    const last = Arr.getUnsafe(yield* Ref.get(contexts), 3)
    expect(Arr.map(last.completed, (entry) => entry.trialNumber)).toEqual([2])
    expect(last.pruned).toEqual([
      new Sampler.PrunedObservation({
        trialNumber: 0,
        config: { x: 0 },
        reports: [new Pruning.Report({ step: 3, value: 0.4 }), new Pruning.Report({ step: 1, value: 0.9 })]
      })
    ])
  }))

it.effect("keeps pending reservations out of completed observations", () =>
  Effect.gen(function*() {
    const history = History.fromIterable([
      Trial.complete(Trial.makeRunning(0, { x: 2 }, 0), 17, 1),
      Trial.makeRunning(1, { x: 9 }, 0)
    ])
    const context = yield* contextForSuggestion(Objective.single(), history, 1, 0)
    expect(context.completed).toHaveLength(1)
    expect(context.completed[0]?.value).toBe(17)
    expect(context.pending).toEqual([new Sampler.Pending({ trialNumber: 1, config: { x: 9 } })])
  }))
