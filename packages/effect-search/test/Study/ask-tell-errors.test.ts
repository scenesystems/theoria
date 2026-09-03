import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("Study ask-tell typed transition errors", () => {
  it.effect("fails invalid transitions with typed SearchError variants and never defects", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 222 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const tellWithoutAsk = yield* Effect.either(Study.tell(handle, 0, 1))
        expect(Either.isLeft(tellWithoutAsk)).toBe(true)

        if (Either.isLeft(tellWithoutAsk)) {
          expect(tellWithoutAsk.left._tag).toBe("effect-search/InvalidStudyConfig")
        }

        const asked = yield* Study.ask(handle)
        yield* Study.tell(handle, asked.trialNumber, 1)

        const duplicateTell = yield* Effect.either(Study.tell(handle, asked.trialNumber, 2))
        expect(Either.isLeft(duplicateTell)).toBe(true)

        if (Either.isLeft(duplicateTell)) {
          expect(duplicateTell.left._tag).toBe("effect-search/InvalidStudyConfig")
        }

        const unknownFailure = yield* Effect.either(
          Study.fail(handle, 77, { message: "manual failure", cause: "unknown-trial" })
        )
        expect(Either.isLeft(unknownFailure)).toBe(true)

        if (Either.isLeft(unknownFailure)) {
          expect(unknownFailure.left._tag).toBe("effect-search/InvalidStudyConfig")
        }

        yield* Study.cancel(handle)

        const askAfterCancel = yield* Effect.either(Study.ask(handle))
        expect(Either.isLeft(askAfterCancel)).toBe(true)

        if (Either.isLeft(askAfterCancel)) {
          expect(askAfterCancel.left._tag).toBe("effect-search/InvalidStudyConfig")
        }
      })
    ))

  it.effect("rejects non-finite single-objective values", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 223 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Study.ask(handle)
        const nanResult = yield* Effect.either(Study.tell(handle, first.trialNumber, Number.NaN))
        expect(Either.isLeft(nanResult)).toBe(true)

        if (Either.isLeft(nanResult)) {
          expect(nanResult.left._tag).toBe("effect-search/InvalidObjectiveValue")
        }

        yield* Study.fail(handle, first.trialNumber, "discard invalid result")

        const second = yield* Study.ask(handle)
        const infinityResult = yield* Effect.either(
          Study.tell(handle, second.trialNumber, Number.POSITIVE_INFINITY)
        )
        expect(Either.isLeft(infinityResult)).toBe(true)

        if (Either.isLeft(infinityResult)) {
          expect(infinityResult.left._tag).toBe("effect-search/InvalidObjectiveValue")
        }
      })
    ))
})
