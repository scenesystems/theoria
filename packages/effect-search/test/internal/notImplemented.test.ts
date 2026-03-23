import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import { NotImplemented } from "../../src/Errors/index.js"
import { notImplemented } from "../../src/internal/notImplemented.js"

describe("internal notImplemented", () => {
  it.effect("fails with a catchable NotImplemented tagged error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(notImplemented("future-feature"))

      expect(Either.isLeft(result)).toBe(true)

      if (Either.isLeft(result)) {
        expect(result.left).toEqual(new NotImplemented({ feature: "future-feature" }))
      }
    }))

  it.effect("supports catchTag recovery", () =>
    Effect.gen(function*() {
      const recovered = yield* notImplemented("future-feature").pipe(
        Effect.catchTag("effect-search/NotImplemented", () => Effect.succeed("recovered"))
      )

      expect(recovered).toBe("recovered")
    }))
})
