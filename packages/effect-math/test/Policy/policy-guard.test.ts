import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Layer, Logger, LogLevel, MutableRef, Schema } from "effect"

import * as PolicyGuard from "../../src/internal/policyGuard.js"
import * as Policy from "../../src/Policy.js"

class InvalidResult extends Schema.TaggedError<InvalidResult>()("InvalidResult", { message: Schema.String }) {}

const relaxedDisabled = Layer.mergeAll(
  Layer.succeed(Policy.Precision, { policy: "relaxed" }),
  Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
)
const strictDisabled = Layer.mergeAll(
  Layer.succeed(Policy.Precision, { policy: "strict" }),
  Layer.succeed(Policy.Diagnostics, { policy: "disabled" })
)
const strictEnabled = Layer.mergeAll(
  Layer.succeed(Policy.Precision, { policy: "strict" }),
  Layer.succeed(Policy.Diagnostics, { policy: "enabled" })
)
const unexpected = () => Schema.decodeUnknownSync(Schema.Never)("unexpected callback")

describe("policyGuard", () => {
  it.effect("does not evaluate strict validation or annotations when policies disable them", () =>
    Effect.gen(function*() {
      const result = yield* PolicyGuard.custom({
        operation: "relaxed",
        compute: () => 42,
        isValid: unexpected,
        makeError: (message) => new InvalidResult({ message }),
        annotations: unexpected
      }).pipe(Effect.provide(relaxedDisabled))

      expect(result).toStrictEqual(42)
    }))

  it.effect("keeps strict validation failures in the typed error channel", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        PolicyGuard.scalar({
          operation: "strict",
          compute: () => Schema.decodeUnknownSync(Schema.NumberFromString)("NaN"),
          makeError: (message) => new InvalidResult({ message }),
          annotations: () => ({ result: "NaN" })
        }).pipe(Effect.provide(strictDisabled))
      )

      expect(error._tag).toStrictEqual("InvalidResult")
      expect(error.message).toContain("Non-finite strict result")
    }))

  it.effect("emits diagnostics only after successful strict validation", () =>
    Effect.gen(function*() {
      const count = MutableRef.make(0)
      const logger = Logger.make(() => MutableRef.increment(count))
      const logging = Layer.mergeAll(strictEnabled, Logger.replace(Logger.defaultLogger, logger))
      const error = yield* Effect.flip(
        PolicyGuard.scalar({
          operation: "rejected",
          compute: () => Schema.decodeUnknownSync(Schema.NumberFromString)("NaN"),
          makeError: (message) => new InvalidResult({ message }),
          annotations: () => ({ result: "NaN" })
        }).pipe(
          Effect.provide(logging),
          Logger.withMinimumLogLevel(LogLevel.Debug)
        )
      )

      expect(error._tag).toStrictEqual("InvalidResult")
      expect(MutableRef.get(count)).toStrictEqual(0)

      const result = yield* PolicyGuard.scalar({
        operation: "logged",
        compute: () => 42,
        makeError: (message) => new InvalidResult({ message }),
        annotations: () => ({ result: "42" })
      }).pipe(
        Effect.provide(logging),
        Logger.withMinimumLogLevel(LogLevel.Debug)
      )

      expect(result).toStrictEqual(42)
      expect(MutableRef.get(count)).toStrictEqual(1)
    }))

  it.effect("retains callback exceptions as defects", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        PolicyGuard.custom({
          operation: "defect",
          compute: () => 1,
          isValid: unexpected,
          makeError: (message) => new InvalidResult({ message }),
          annotations: () => ({ result: "1" })
        }).pipe(Effect.provide(strictDisabled))
      )

      expect(Exit.isFailure(exit)).toStrictEqual(true)
      expect(Exit.match(exit, { onFailure: Cause.isDie, onSuccess: () => false })).toStrictEqual(true)
    }))
})
