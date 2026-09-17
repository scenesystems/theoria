import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Number as Num, Option, Ref } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    depth: SearchSpace.int(1, 3)
  })

const score = (config: { readonly x: number; readonly depth: number }) => Num.sum(config.x, config.depth)

const asSingleObjective = (
  result: Optimization.Result
): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization ask-tell basic", () => {
  it.scoped("cancels pending reservations without discarding completed observations", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const sampler = Sampler.random({ seed: 29 })
      const handle = yield* Optimization.open({ space, sampler, trials: 3, objective: () => Effect.succeed(0) })
      const completed = yield* Optimization.ask(handle)
      yield* Optimization.tell(handle, completed.trialNumber, 7)
      const pending = yield* Optimization.ask(handle)
      const activeSnapshot = yield* Optimization.snapshot(handle)
      yield* Optimization.cancel(handle)
      yield* Optimization.cancel(handle)
      const snapshot = yield* Optimization.snapshot(handle)
      expect(Arr.map(snapshot.trials, (trial) => trial.state._tag)).toEqual(Arr.make("Completed", "Cancelled"))
      expect(Either.isLeft(yield* Effect.either(Optimization.tell(handle, pending.trialNumber, 5)))).toBe(true)
      const restored = yield* Optimization.resume({
        space,
        sampler,
        snapshot: activeSnapshot,
        trials: 1,
        objective: () => Effect.succeed(3)
      })
      expect(Arr.map(Arr.fromIterable(restored.trials), (trial) => trial.state._tag)).toEqual(
        Arr.make("Completed", "Cancelled", "Completed")
      )
      expect(Arr.map(Arr.fromIterable(restored.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1, 2))
    }))

  it.scoped("keeps prior observations outside the fresh budget and trial numbering", () =>
    Effect.gen(function*() {
      const handle = yield* Optimization.open({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 13 }),
        trials: 2,
        priorTrials: Arr.of({ config: { x: 0.5, depth: 2 }, value: 5 }),
        objective: () => Effect.succeed(0)
      })
      const first = yield* Optimization.ask(handle)
      expect(first.trialNumber).toBe(0)
      yield* Optimization.tell(handle, first.trialNumber, 3)
      const second = yield* Optimization.ask(handle)
      expect(second.trialNumber).toBe(1)
      yield* Optimization.tell(handle, second.trialNumber, 1)
      const result = yield* Optimization.result(handle)
      expect(Arr.map(Arr.fromIterable(result.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(-1, 0, 1))
      expect(Either.isLeft(yield* Effect.either(Optimization.ask(handle)))).toBe(true)
    }))

  it.effect("acquires the sampler before asking and releases it when its scope fails", () =>
    Effect.gen(function*() {
      const active = yield* Ref.make(false)
      const releases = yield* Ref.make(0)
      const grid = Sampler.random({ seed: 18 })
      const sampler = new Sampler.Sampler({
        ...grid,
        acquire: Ref.set(active, true),
        release: Ref.set(active, false).pipe(Effect.zipRight(Ref.update(releases, Num.increment))),
        suggest: (space, context) =>
          Ref.get(active).pipe(
            Effect.filterOrDieMessage((value) => value, "sampler not acquired"),
            Effect.zipRight(grid.suggest(space, context))
          )
      })
      const exit = yield* Effect.scoped(Effect.gen(function*() {
        const handle = yield* Optimization.open({
          space: yield* makeSpace(),
          sampler,
          trials: 2,
          objective: () => Effect.succeed(0)
        })
        const trial = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, trial.trialNumber, 3)
        return yield* Effect.fail("caller failure")
      })).pipe(Effect.either)
      expect(exit).toEqual(Either.left("caller failure"))
      expect(yield* Ref.get(active)).toBe(false)
      expect(yield* Ref.get(releases)).toBe(1)
    }))

  it.effect("supports deterministic ask -> tell accumulation and returns Result contracts", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = yield* makeSpace()
        const handle = yield* Optimization.open({
          space,
          sampler: Sampler.random({ seed: 111 }),
          direction: "minimize",
          trials: 3,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, first.trialNumber, score(first.config))

        const second = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, second.trialNumber, score(second.config))

        const third = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, third.trialNumber, score(third.config))

        const result = yield* Optimization.result(handle)

        expect(result._tag).toBe("SingleObjective")
        const single = yield* asSingleObjective(result)

        expect(single.trials).toHaveLength(3)
        expect(Arr.map(Arr.fromIterable(single.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1, 2))

        const completedValues = Arr.flatMap(Arr.fromIterable(single.trials), (trial) =>
          Match.value(trial.state).pipe(
            Match.tag("Completed", ({ value }) => Arr.of(value)),
            Match.orElse(Arr.empty)
          ))

        expect(completedValues).toHaveLength(3)
        expect(single.bestTrial.trialNumber).toBeGreaterThanOrEqual(0)
      })
    ))
})
