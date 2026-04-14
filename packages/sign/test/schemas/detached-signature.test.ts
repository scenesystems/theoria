import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import { DetachedSignature } from "../../src/schemas/DetachedSignature.js"

describe("DetachedSignature — Schema.Class", () => {
  const mockSignature = new Uint8Array(64).fill(0xaa)

  it("constructs a portable detached carrier without a public key field", () => {
    const signature = new DetachedSignature({
      algorithm: "ed25519",
      signature: mockSignature
    })

    expect(signature.algorithm).toBe("ed25519")
    expect(signature.signature).toEqual(mockSignature)
    expect(Reflect.has(signature, "publicKey")).toBe(false)
  })

  it.effect("round-trips encode → decode and rejects excess identity material at the boundary", () =>
    Effect.gen(function*() {
      const signature = new DetachedSignature({
        algorithm: "ml-dsa-65",
        signature: mockSignature
      })
      const encoded = yield* Schema.encode(DetachedSignature)(signature)
      const decoded = yield* Schema.decode(DetachedSignature)(encoded)
      const excess = yield* Schema.decodeUnknown(DetachedSignature)(
        {
          algorithm: "ed25519",
          signature: mockSignature,
          publicKey: new Uint8Array(32).fill(0xbb)
        },
        { onExcessProperty: "error" }
      ).pipe(Effect.either)

      expect(decoded.algorithm).toBe("ml-dsa-65")
      expect(decoded.signature).toEqual(mockSignature)
      expect(Either.isLeft(excess)).toBe(true)
    }))

  it("rejects non-signature algorithms", () => {
    const result = Schema.decodeUnknownEither(DetachedSignature)({
      algorithm: "x25519",
      signature: mockSignature
    })

    expect(Either.isLeft(result)).toBe(true)
  })
})
