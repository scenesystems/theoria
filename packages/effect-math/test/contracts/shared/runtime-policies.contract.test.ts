import { describe, expect, it } from "@effect/vitest"
import { Cause, Data, Effect, Exit, Match, MutableRef, Number, Schema } from "effect"

import {
  collectRuntimePolicies,
  DeterministicRuntimePoliciesInputSchema,
  makeDeterministicRuntimePoliciesLayer,
  makeNondeterministicRuntimePoliciesLayer,
  NondeterministicRuntimePoliciesInputSchema,
  RngPolicySchema,
  RuntimePolicies,
  Seed,
  withCustomPolicyGuards,
  withScalarPolicyGuards
} from "../../../src/contracts/index.js"

class PolicyGuardFailure extends Data.TaggedError("PolicyGuardFailure")<{
  readonly message: string
}> {}

const callbackDefect = (): never => Schema.decodeUnknownSync(Schema.Never)("policy callback defect")

const expectDefect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function*() {
    const exit = yield* Effect.exit(effect)
    const cause = yield* Exit.causeOption(exit)
    expect(Cause.isDie(cause)).toBe(true)
  })

const deterministicInput = Schema.decodeUnknownSync(DeterministicRuntimePoliciesInputSchema)({
  seed: Seed.make(42),
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
        seed: yield* Schema.decodeUnknown(Seed)(7)
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
})

describe("shared policy guards", () => {
  it.effect("keeps computation lazy and skips strict validation and diagnostics when relaxed and disabled", () =>
    Effect.gen(function*() {
      const computations = MutableRef.make(0)
      const validations = MutableRef.make(0)
      const annotations = MutableRef.make(0)
      const guarded = withCustomPolicyGuards({
        operation: "PolicyGuard.lazy",
        compute: () => {
          MutableRef.increment(computations)
          return 7
        },
        isValid: () => {
          MutableRef.increment(validations)
          return false
        },
        makeError: (message) => new PolicyGuardFailure({ message }),
        annotations: () => {
          MutableRef.increment(annotations)
          return { result: "7" }
        }
      })

      expect(MutableRef.get(computations)).toBe(0)
      expect(MutableRef.get(validations)).toBe(0)
      expect(MutableRef.get(annotations)).toBe(0)

      expect(
        yield* guarded.pipe(
          Effect.provide(makeNondeterministicRuntimePoliciesLayer(nondeterministicInput))
        )
      ).toBe(7)
      expect(MutableRef.get(computations)).toBe(1)
      expect(MutableRef.get(validations)).toBe(0)
      expect(MutableRef.get(annotations)).toBe(0)
    }))

  it.effect("returns the caller's checked custom error under strict precision", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        withCustomPolicyGuards({
          operation: "PolicyGuard.checked",
          compute: () => 7,
          isValid: (result) => Number.lessThan(result, 0),
          makeError: (message) => new PolicyGuardFailure({ message }),
          annotations: () => ({})
        })
      )

      expect(error._tag).toBe("PolicyGuardFailure")
      expect(error.message).toBe("Non-finite PolicyGuard.checked result")
    }).pipe(Effect.provide(makeDeterministicRuntimePoliciesLayer(deterministicInput))))

  it.effect("executes annotation construction after a successful enabled strict check", () =>
    Effect.gen(function*() {
      const annotations = MutableRef.make(0)
      const result = yield* withScalarPolicyGuards({
        operation: "PolicyGuard.enabled",
        compute: () => 7,
        makeError: (message) => new PolicyGuardFailure({ message }),
        annotations: () => {
          MutableRef.increment(annotations)
          return { result: "7" }
        }
      })

      expect(result).toBe(7)
      expect(MutableRef.get(annotations)).toBe(1)
    }).pipe(Effect.provide(makeDeterministicRuntimePoliciesLayer(deterministicInput))))

  it.effect("turns exceptions from every callback position into defects", () =>
    Effect.gen(function*() {
      yield* expectDefect(
        withCustomPolicyGuards({
          operation: "PolicyGuard.computeDefect",
          compute: callbackDefect,
          isValid: () => true,
          makeError: (message) => new PolicyGuardFailure({ message }),
          annotations: () => ({})
        }).pipe(Effect.provide(makeNondeterministicRuntimePoliciesLayer(nondeterministicInput)))
      )

      yield* expectDefect(
        withCustomPolicyGuards({
          operation: "PolicyGuard.validationDefect",
          compute: () => 7,
          isValid: callbackDefect,
          makeError: (message) => new PolicyGuardFailure({ message }),
          annotations: () => ({})
        }).pipe(Effect.provide(makeDeterministicRuntimePoliciesLayer(deterministicInput)))
      )

      yield* expectDefect(
        withCustomPolicyGuards({
          operation: "PolicyGuard.errorDefect",
          compute: () => 7,
          isValid: () => false,
          makeError: callbackDefect,
          annotations: () => ({})
        }).pipe(Effect.provide(makeDeterministicRuntimePoliciesLayer(deterministicInput)))
      )

      yield* expectDefect(
        withScalarPolicyGuards({
          operation: "PolicyGuard.annotationDefect",
          compute: () => 7,
          makeError: (message) => new PolicyGuardFailure({ message }),
          annotations: callbackDefect
        }).pipe(Effect.provide(makeDeterministicRuntimePoliciesLayer(deterministicInput)))
      )
    }))
})
