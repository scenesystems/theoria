import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Layer, Schema } from "effect"

import { withCustomPolicyGuards, withScalarPolicyGuards } from "../../../src/contracts/shared/PolicyGuards.js"
import { DiagnosticsPolicyService, PrecisionPolicyService } from "../../../src/contracts/shared/RuntimePolicies.js"

class InvalidGuardResult extends Schema.TaggedError<InvalidGuardResult>()("InvalidGuardResult", {
  message: Schema.String
}) {}

const relaxedWithoutDiagnostics = Layer.mergeAll(
  Layer.succeed(PrecisionPolicyService, { policy: "relaxed" }),
  Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
)

const strictWithoutDiagnostics = Layer.mergeAll(
  Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
  Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
)

const unexpectedCallback = () => Schema.decodeUnknownSync(Schema.Never)("unexpected callback")

describe("shared policy guards", () => {
  it.effect("does not evaluate strict validation or annotations when both policies disable them", () =>
    Effect.gen(function*() {
      const result = yield* withCustomPolicyGuards({
        operation: "relaxed",
        compute: () => 42,
        isValid: unexpectedCallback,
        makeError: (message) => new InvalidGuardResult({ message }),
        annotations: unexpectedCallback
      }).pipe(Effect.provide(relaxedWithoutDiagnostics))

      expect(result).toStrictEqual(42)
    }))

  it.effect("keeps strict validation failures in the typed error channel", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        withScalarPolicyGuards({
          operation: "strict",
          compute: () => Schema.decodeUnknownSync(Schema.NumberFromString)("NaN"),
          makeError: (message) => new InvalidGuardResult({ message }),
          annotations: () => ({ result: "NaN" })
        }).pipe(Effect.provide(strictWithoutDiagnostics))
      )

      expect(error._tag).toStrictEqual("InvalidGuardResult")
      expect(error.message).toContain("Non-finite strict result")
    }))

  it.effect("retains callback exceptions as documented defects", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        withCustomPolicyGuards({
          operation: "defect",
          compute: () => 1,
          isValid: unexpectedCallback,
          makeError: (message) => new InvalidGuardResult({ message }),
          annotations: () => ({ result: "1" })
        }).pipe(Effect.provide(strictWithoutDiagnostics))
      )

      expect(Exit.isFailure(exit)).toStrictEqual(true)
      expect(Exit.match(exit, {
        onFailure: Cause.isDie,
        onSuccess: () => false
      })).toStrictEqual(true)
    }))
})
