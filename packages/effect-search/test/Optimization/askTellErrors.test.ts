import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Number as Num } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1)
  })

describe("Optimization ask-tell typed transition errors", () => {
  it.effect("prevents reservations after the opening scope closes", () =>
    Effect.gen(function*() {
      const optimization = yield* Effect.scoped(
        Optimization.open({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 221 }),
          direction: "minimize",
          trials: 1,
          objective: () => Effect.succeed(0)
        })
      )

      const reservation = yield* Effect.either(Optimization.ask(optimization))
      expect(Either.isLeft(reservation)).toBe(true)
      expect(Either.getOrThrow(Either.flip(reservation))._tag).toBe("effect-search/InvalidOptimizationConfig")
    }))

  it.effect("fails invalid transitions with typed SearchError variants and never defects", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Optimization.open({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 222 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const tellWithoutAsk = yield* Effect.either(Optimization.tell(handle, 0, 1))
        expect(Either.isLeft(tellWithoutAsk)).toBe(true)
        expect(Either.getOrThrow(Either.flip(tellWithoutAsk))._tag).toBe("effect-search/InvalidOptimizationConfig")

        const asked = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, asked.trialNumber, 1)

        const duplicateTell = yield* Effect.either(Optimization.tell(handle, asked.trialNumber, 2))
        expect(Either.isLeft(duplicateTell)).toBe(true)
        expect(Either.getOrThrow(Either.flip(duplicateTell))._tag).toBe("effect-search/InvalidOptimizationConfig")

        const unknownFailure = yield* Effect.either(
          Optimization.fail(handle, 77, { message: "manual failure", cause: "unknown-trial" })
        )
        expect(Either.isLeft(unknownFailure)).toBe(true)
        expect(Either.getOrThrow(Either.flip(unknownFailure))._tag).toBe("effect-search/InvalidOptimizationConfig")

        yield* Optimization.cancel(handle)

        const askAfterCancel = yield* Effect.either(Optimization.ask(handle))
        expect(Either.isLeft(askAfterCancel)).toBe(true)
        expect(Either.getOrThrow(Either.flip(askAfterCancel))._tag).toBe("effect-search/InvalidOptimizationConfig")
      })
    ))

  it.effect("rejects non-finite single-objective values", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Optimization.open({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 223 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Optimization.ask(handle)
        const nanResult = yield* Effect.either(Optimization.tell(handle, first.trialNumber, Number.NaN))
        expect(Either.isLeft(nanResult)).toBe(true)
        expect(Either.getOrThrow(Either.flip(nanResult))._tag).toBe("effect-search/InvalidObjectiveValue")

        yield* Optimization.fail(handle, first.trialNumber, "discard invalid result")

        const second = yield* Optimization.ask(handle)
        const infinityResult = yield* Effect.either(
          Optimization.tell(handle, second.trialNumber, Number.POSITIVE_INFINITY)
        )
        expect(Either.isLeft(infinityResult)).toBe(true)
        expect(Either.getOrThrow(Either.flip(infinityResult))._tag).toBe("effect-search/InvalidObjectiveValue")
      })
    ))
})
