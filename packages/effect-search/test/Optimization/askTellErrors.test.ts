import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Result } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.multiply(-1, 1), 1)
  })

describe("Optimization ask-tell typed transition errors", () => {
  it.effect("prevents reservations after the opening scope closes", () =>
    Effect.gen(function*() {
      const optimization = yield* Effect.scoped(
        Optimization.open(
          new Optimization.FlatOptions({
            space: yield* makeSpace(),
            sampler: Sampler.random({ seed: 221 }),
            direction: "minimize",
            trials: 1,
            objective: () => Effect.succeed(0)
          })
        )
      )

      const reservation = yield* Effect.result(Optimization.ask(optimization))
      expect(Result.isFailure(reservation)).toBe(true)
      expect(Result.getOrThrow(Result.flip(reservation))._tag).toBe("effect-search/InvalidOptimizationConfig")
    }))

  it.effect("fails invalid transitions with typed SearchError variants and never defects", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Optimization.open(
          new Optimization.FlatOptions({
            space: yield* makeSpace(),
            sampler: Sampler.random({ seed: 222 }),
            direction: "minimize",
            trials: 2,
            objective: () => Effect.succeed(0)
          })
        )

        const tellWithoutAsk = yield* Effect.result(Optimization.tell(handle, 0, 1))
        expect(Result.isFailure(tellWithoutAsk)).toBe(true)
        expect(Result.getOrThrow(Result.flip(tellWithoutAsk))._tag).toBe("effect-search/InvalidOptimizationConfig")

        const asked = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, asked.trialNumber, 1)

        const duplicateTell = yield* Effect.result(Optimization.tell(handle, asked.trialNumber, 2))
        expect(Result.isFailure(duplicateTell)).toBe(true)
        expect(Result.getOrThrow(Result.flip(duplicateTell))._tag).toBe("effect-search/InvalidOptimizationConfig")

        const unknownFailure = yield* Effect.result(
          Optimization.fail(handle, 77, { message: "manual failure", cause: "unknown-trial" })
        )
        expect(Result.isFailure(unknownFailure)).toBe(true)
        expect(Result.getOrThrow(Result.flip(unknownFailure))._tag).toBe("effect-search/InvalidOptimizationConfig")

        yield* Optimization.cancel(handle)

        const askAfterCancel = yield* Effect.result(Optimization.ask(handle))
        expect(Result.isFailure(askAfterCancel)).toBe(true)
        expect(Result.getOrThrow(Result.flip(askAfterCancel))._tag).toBe("effect-search/InvalidOptimizationConfig")
      })
    ))

  it.effect("rejects non-finite single-objective values", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Optimization.open(
          new Optimization.FlatOptions({
            space: yield* makeSpace(),
            sampler: Sampler.random({ seed: 223 }),
            direction: "minimize",
            trials: 2,
            objective: () => Effect.succeed(0)
          })
        )

        const first = yield* Optimization.ask(handle)
        const nanResult = yield* Effect.result(Optimization.tell(handle, first.trialNumber, Number.NaN))
        expect(Result.isFailure(nanResult)).toBe(true)
        expect(Result.getOrThrow(Result.flip(nanResult))._tag).toBe("effect-search/InvalidObjectiveValue")

        yield* Optimization.fail(handle, first.trialNumber, "discard invalid result")

        const second = yield* Optimization.ask(handle)
        const infinityResult = yield* Effect.result(
          Optimization.tell(handle, second.trialNumber, Number.POSITIVE_INFINITY)
        )
        expect(Result.isFailure(infinityResult)).toBe(true)
        expect(Result.getOrThrow(Result.flip(infinityResult))._tag).toBe("effect-search/InvalidObjectiveValue")
      })
    ))
})
