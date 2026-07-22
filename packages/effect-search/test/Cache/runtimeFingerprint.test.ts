import { describe, expect, it } from "@effect/vitest"
import { InvalidUnicode, UnsupportedValue } from "@scenesystems/digest"
import { Effect, Exit, Schema } from "effect"

import { durableFingerprint, runtimeFingerprint, RuntimeFingerprintError } from "../../src/Cache/index.js"

describe("Cache/runtimeFingerprint", () => {
  it.effect("rejects malformed Unicode without replacement encoding", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(runtimeFingerprint("\uD800"))

      expect(exit).toStrictEqual(
        Exit.fail(
          new InvalidUnicode({
            kind: "lone-high-surrogate",
            // `5:str:` precedes the malformed code unit in the token payload.
            codeUnitIndex: 6
          })
        )
      )
    }))

  it.effect("preserves stable distinct valid Unicode fingerprints", () =>
    Effect.gen(function*() {
      const first = yield* runtimeFingerprint({ label: "é", values: [1, 2] })
      const reordered = yield* runtimeFingerprint({ values: [1, 2], label: "é" })
      const decomposed = yield* runtimeFingerprint({ label: "e\u0301", values: [1, 2] })

      expect(first).toBe(reordered)
      expect(first).not.toBe(decomposed)
      expect(first).toBe("runtime-blake3-256:Dws2R8b6_da9W38FkW74mR6ilhn1LUb01SWrXFvz0Fk")
      expect(first).toMatch(/^runtime-blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("uses a closed package-owned error for unsupported runtime values", () =>
    Effect.gen(function*() {
      const symbolExit = yield* Effect.exit(runtimeFingerprint(Symbol("rejected material")))
      const functionExit = yield* Effect.exit(runtimeFingerprint(() => "rejected material"))
      const unsupportedExit = yield* Effect.exit(runtimeFingerprint(/rejected material/))

      expect(symbolExit).toStrictEqual(Exit.fail(new RuntimeFingerprintError({ reason: "symbol" })))
      expect(functionExit).toStrictEqual(Exit.fail(new RuntimeFingerprintError({ reason: "function" })))
      expect(unsupportedExit).toStrictEqual(Exit.fail(new RuntimeFingerprintError({ reason: "unsupported-value" })))
    }))

  it.effect("Schema-decodes only the closed runtime rejection vocabulary", () =>
    Effect.gen(function*() {
      const error = new RuntimeFingerprintError({ reason: "unsupported-value" })
      const encoded = yield* Schema.encode(RuntimeFingerprintError)(error)
      const decoded = yield* Schema.decodeUnknown(RuntimeFingerprintError)(encoded)
      const foreign = yield* Effect.exit(
        Schema.decodeUnknown(RuntimeFingerprintError)({
          _tag: "effect-search/RuntimeFingerprintError",
          reason: "provider-message"
        })
      )

      expect(encoded).toStrictEqual({
        _tag: "effect-search/RuntimeFingerprintError",
        reason: "unsupported-value"
      })
      expect(decoded.reason).toBe("unsupported-value")
      expect(Exit.isFailure(foreign)).toBe(true)
    }))

  it.effect("exposes digest canonicalization errors directly from durable fingerprints", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(durableFingerprint(/not a JCS value/))

      expect(exit).toStrictEqual(Exit.fail(new UnsupportedValue({ reason: "regexp" })))
    }))
})
