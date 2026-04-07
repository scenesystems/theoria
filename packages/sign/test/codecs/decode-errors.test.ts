import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import { decodeKeyPair, decodeSignature, toBase64Url } from "../../src/index.js"

const validBytes = toBase64Url(Uint8Array.from([1, 2, 3, 4]))

describe("portable key-material decode failures", () => {
  it.effect("fails malformed base64url payloads through PortableCodecDecodeFailed", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        decodeKeyPair({
          algorithm: "ed25519",
          publicKey: "***not-base64url***",
          secretKey: validBytes
        })
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("PortableCodecDecodeFailed")
        expect(result.left.material).toBe("key-pair")
      }
    }))

  it.effect("fails algorithm-mismatched payloads through PortableCodecDecodeFailed", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        decodeSignature({
          algorithm: "x25519",
          signature: validBytes,
          publicKey: validBytes
        })
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("PortableCodecDecodeFailed")
        expect(result.left.material).toBe("signature")
      }
    }))
})
