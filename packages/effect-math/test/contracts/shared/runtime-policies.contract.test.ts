import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Number, Record as EffectRecord, Schema } from "effect"
import * as Arr from "effect/Array"

import { Seed } from "../../../src/contracts/shared/BrandedScalars.js"
import {
  collectRuntimePolicies,
  DeterministicRuntimePoliciesInputSchema,
  makeDeterministicRuntimePoliciesLayer,
  makeNondeterministicRuntimePoliciesLayer,
  NondeterministicRuntimePoliciesInputSchema,
  RngPolicySchema,
  RuntimePolicies
} from "../../../src/contracts/shared/RuntimePolicies.js"

const deterministicInput = Schema.decodeUnknownSync(DeterministicRuntimePoliciesInputSchema)({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

const nondeterministicInput = Schema.decodeUnknownSync(NondeterministicRuntimePoliciesInputSchema)({
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("shared runtime policy contracts", () => {
  it.effect("collects deterministic and nondeterministic policies as RuntimePolicies authority", () =>
    Effect.gen(function*() {
      const deterministic = yield* collectRuntimePolicies.pipe(
        Effect.provide(makeDeterministicRuntimePoliciesLayer(deterministicInput))
      )
      const nondeterministic = yield* collectRuntimePolicies.pipe(
        Effect.provide(makeNondeterministicRuntimePoliciesLayer(nondeterministicInput))
      )

      expect(yield* Schema.decodeUnknown(RuntimePolicies)(deterministic)).toStrictEqual(deterministic)
      expect(yield* Schema.decodeUnknown(RuntimePolicies)(nondeterministic)).toStrictEqual(nondeterministic)

      expect(
        Match.value(deterministic.rngPolicy).pipe(
          Match.when({ policy: "deterministic" }, ({ seed }) => Number.Equivalence(seed, deterministicInput.seed)),
          Match.orElse(() => false)
        )
      ).toStrictEqual(true)

      expect(
        Match.value(nondeterministic.rngPolicy).pipe(
          Match.when({ policy: "nondeterministic" }, () => true),
          Match.orElse(() => false)
        )
      ).toStrictEqual(true)

      expect(
        Match.value(deterministic).pipe(
          Match.when(
            {
              backendPolicy: { policy: "typed-array" },
              precisionPolicy: { policy: "strict" },
              diagnosticsPolicy: { policy: "enabled" }
            },
            () => true
          ),
          Match.orElse(() => false)
        )
      ).toStrictEqual(true)

      expect(
        Match.value(nondeterministic).pipe(
          Match.when(
            {
              backendPolicy: { policy: "scalar" },
              precisionPolicy: { policy: "relaxed" },
              diagnosticsPolicy: { policy: "disabled" }
            },
            () => true
          ),
          Match.orElse(() => false)
        )
      ).toStrictEqual(true)
    }))

  it.effect("rejects excess properties at boundary decode for runtime policy unions", () =>
    Effect.gen(function*() {
      const withExcess = {
        policy: "nondeterministic",
        seed: Schema.decodeUnknownSync(Seed)(7)
      }

      const result = yield* Effect.either(
        Schema.decodeUnknown(RngPolicySchema)(withExcess, {
          onExcessProperty: "error"
        })
      )

      expect(
        Match.value(result).pipe(
          Match.tag("Left", () => true),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))

  it("keeps runtime policy contract key set stable", () => {
    const contractKeys = EffectRecord.keys(RuntimePolicies.fields).sort()
    const expectedKeys = Arr.make("rngPolicy", "precisionPolicy", "backendPolicy", "diagnosticsPolicy").sort()

    expect(contractKeys).toStrictEqual(expectedKeys)
  })
})
