/**
 * Error model contract tests.
 *
 * Verifies all four errors are:
 * - Yieldable in Effect.gen
 * - Catchable via Effect.catchTag
 * - Carry expected fields
 * - Have correct _tag discrimination
 * - Are Schema-serializable (encode → decode round-trip)
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { InvalidSignature, KeyGenerationFailed, SigningFailed, VerificationFailed } from "../../src/schemas/errors.js"

describe("SigningFailed — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new SigningFailed({
            algorithm: "ed25519",
            reason: "corrupt key"
          })
        })
      )
      expect(result._tag).toBe("Failure")
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new SigningFailed({
        algorithm: "ed25519",
        reason: "test"
      }).pipe(
        Effect.catchTag("SigningFailed", (e) => Effect.succeed(e.algorithm))
      )
      expect(result).toBe("ed25519")
    }))

  it.effect("carries algorithm and reason fields", () =>
    Effect.gen(function*() {
      const err = new SigningFailed({
        algorithm: "ml-dsa-65",
        reason: "entropy exhausted"
      })
      expect(err.algorithm).toBe("ml-dsa-65")
      expect(err.reason).toBe("entropy exhausted")
    }))

  it.effect("has correct _tag discrimination", () =>
    Effect.gen(function*() {
      const err = new SigningFailed({ algorithm: "ed25519", reason: "test" })
      expect(err._tag).toBe("SigningFailed")
    }))

  it.effect("round-trips through Schema encode/decode", () =>
    Effect.gen(function*() {
      const err = new SigningFailed({ algorithm: "ed25519", reason: "test" })
      const encoded = yield* Schema.encode(SigningFailed)(err)
      const decoded = yield* Schema.decode(SigningFailed)(encoded)
      expect(decoded.algorithm).toBe("ed25519")
      expect(decoded.reason).toBe("test")
      expect(decoded._tag).toBe("SigningFailed")
    }))
})

describe("VerificationFailed — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new VerificationFailed({
            algorithm: "ed25519",
            reason: "signature mismatch"
          })
        })
      )
      expect(result._tag).toBe("Failure")
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new VerificationFailed({
        algorithm: "secp256k1-schnorr",
        reason: "invalid"
      }).pipe(
        Effect.catchTag("VerificationFailed", (e) => Effect.succeed(e.reason))
      )
      expect(result).toBe("invalid")
    }))

  it.effect("carries algorithm and reason fields", () =>
    Effect.gen(function*() {
      const err = new VerificationFailed({
        algorithm: "slh-dsa-sha2-128f",
        reason: "wrong public key"
      })
      expect(err.algorithm).toBe("slh-dsa-sha2-128f")
      expect(err.reason).toBe("wrong public key")
    }))

  it.effect("has correct _tag discrimination", () =>
    Effect.gen(function*() {
      const err = new VerificationFailed({ algorithm: "ed25519", reason: "test" })
      expect(err._tag).toBe("VerificationFailed")
    }))
})

describe("InvalidSignature — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new InvalidSignature({
            algorithm: "ed25519",
            reason: "wrong length"
          })
        })
      )
      expect(result._tag).toBe("Failure")
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new InvalidSignature({
        algorithm: "ml-dsa-87",
        reason: "truncated"
      }).pipe(
        Effect.catchTag("InvalidSignature", (e) => Effect.succeed(e.algorithm))
      )
      expect(result).toBe("ml-dsa-87")
    }))

  it.effect("carries algorithm and reason fields", () =>
    Effect.gen(function*() {
      const err = new InvalidSignature({
        algorithm: "secp256k1-ecdsa",
        reason: "DER decode failed"
      })
      expect(err.algorithm).toBe("secp256k1-ecdsa")
      expect(err.reason).toBe("DER decode failed")
    }))

  it.effect("has correct _tag discrimination", () =>
    Effect.gen(function*() {
      const err = new InvalidSignature({ algorithm: "ed25519", reason: "test" })
      expect(err._tag).toBe("InvalidSignature")
    }))
})

describe("KeyGenerationFailed — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const result = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new KeyGenerationFailed({
            algorithm: "xwing",
            reason: "unsupported"
          })
        })
      )
      expect(result._tag).toBe("Failure")
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new KeyGenerationFailed({
        algorithm: "x25519",
        reason: "entropy"
      }).pipe(
        Effect.catchTag("KeyGenerationFailed", (e) => Effect.succeed(e.reason))
      )
      expect(result).toBe("entropy")
    }))

  it.effect("carries algorithm and reason fields", () =>
    Effect.gen(function*() {
      const err = new KeyGenerationFailed({
        algorithm: "ml-dsa-44",
        reason: "invalid parameters"
      })
      expect(err.algorithm).toBe("ml-dsa-44")
      expect(err.reason).toBe("invalid parameters")
    }))

  it.effect("has correct _tag discrimination", () =>
    Effect.gen(function*() {
      const err = new KeyGenerationFailed({ algorithm: "ed25519", reason: "test" })
      expect(err._tag).toBe("KeyGenerationFailed")
    }))

  it.effect("round-trips through Schema encode/decode", () =>
    Effect.gen(function*() {
      const err = new KeyGenerationFailed({ algorithm: "xwing", reason: "no entropy" })
      const encoded = yield* Schema.encode(KeyGenerationFailed)(err)
      const decoded = yield* Schema.decode(KeyGenerationFailed)(encoded)
      expect(decoded.algorithm).toBe("xwing")
      expect(decoded.reason).toBe("no entropy")
      expect(decoded._tag).toBe("KeyGenerationFailed")
    }))
})
