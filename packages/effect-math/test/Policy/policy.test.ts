import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number, Schema } from "effect"

import * as Policy from "../../src/Policy.js"

const deterministic = Schema.decodeUnknownSync(Policy.DeterministicOptions)({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "compensated",
  diagnostics: "enabled"
})

const nondeterministic = Schema.decodeUnknownSync(Policy.NondeterministicOptions)({
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("Policy", () => {
  it.effect("snapshots deterministic and nondeterministic service values", () =>
    Effect.gen(function*() {
      const seeded = yield* Policy.snapshot.pipe(Effect.provide(Policy.layerDeterministic(deterministic)))
      const unseeded = yield* Policy.snapshot.pipe(Effect.provide(Policy.layerNondeterministic(nondeterministic)))

      expect(yield* Schema.decodeUnknown(Policy.Settings)(seeded)).toStrictEqual(seeded)
      expect(yield* Schema.decodeUnknown(Policy.Settings)(unseeded)).toStrictEqual(unseeded)
      expect(
        Match.value(seeded.rngPolicy).pipe(
          Match.when({ policy: "deterministic" }, ({ seed }) => Number.Equivalence(seed, deterministic.seed)),
          Match.when({ policy: "nondeterministic" }, () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
      expect(unseeded.rngPolicy).toStrictEqual({ policy: "nondeterministic" })
      expect(seeded.backendPolicy).toStrictEqual({ policy: "compensated" })
      expect(unseeded.precisionPolicy).toStrictEqual({ policy: "relaxed" })
    }))

  it.effect("rejects deterministic-only fields on nondeterministic policy input", () =>
    Effect.gen(function*() {
      const decoded = yield* Effect.either(
        Schema.decodeUnknown(Policy.RandomnessPolicy)(
          { policy: "nondeterministic", seed: Policy.Seed.make(7) },
          { onExcessProperty: "error" }
        )
      )

      expect(decoded._tag).toStrictEqual("Left")
    }))
})
