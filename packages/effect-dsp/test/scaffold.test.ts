import { describe, it } from "@effect/vitest"
import { Effect } from "effect"

describe("effect-dsp scaffold", () => {
  it.effect("package is importable", () =>
    Effect.gen(function*() {
      yield* Effect.succeed(true)
    }))
})
