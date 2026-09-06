import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { ed25519Verify } from "../../src/algorithms/ed25519.js"
import { mlDsa65SignHedged, mlDsa65Verify } from "../../src/algorithms/mlDsa.js"
import { p256Sha256P1363LowSVerify } from "../../src/algorithms/p256.js"
import { DIRECT_VERIFICATION_MAX_MESSAGE_BYTES } from "../../src/internal/verificationInput.js"
import { generateKeyPair } from "../../src/keyPair.js"

const EMPTY_CONTEXT = new Uint8Array(0)

const failureTag = <A, E extends { readonly _tag: string }>(effect: Effect.Effect<A, E>) =>
  Effect.flip(effect).pipe(Effect.map((error) => error._tag))

/** Bytes whose buffer has been transferred away, as after a postMessage: reading them raises. */
const detachedBytes = (byteLength: number): Uint8Array => {
  const buffer = new ArrayBuffer(byteLength)
  const bytes = new Uint8Array(buffer)
  buffer.transfer()
  return bytes
}

const uncopyableBytes = (byteLength: number): Uint8Array =>
  new Proxy(new Uint8Array(byteLength), {
    get: (target, property) => property === "length" ? target.length : Reflect.get(target, property)
  })

describe("strict direct verification admission", () => {
  it.effect("returns typed failures for detached and uncopyable inputs without throwing at construction", () =>
    Effect.gen(function*() {
      const verifications = [
        ed25519Verify(detachedBytes(64), new Uint8Array(0), new Uint8Array(32)),
        ed25519Verify(new Uint8Array(64), detachedBytes(0), new Uint8Array(32)),
        ed25519Verify(new Uint8Array(64), new Uint8Array(0), detachedBytes(32)),
        ed25519Verify(uncopyableBytes(64), new Uint8Array(0), new Uint8Array(32)),
        p256Sha256P1363LowSVerify(detachedBytes(64), new Uint8Array(0), new Uint8Array(65)),
        p256Sha256P1363LowSVerify(new Uint8Array(64), detachedBytes(0), new Uint8Array(65)),
        p256Sha256P1363LowSVerify(new Uint8Array(64), new Uint8Array(0), detachedBytes(65)),
        mlDsa65Verify(detachedBytes(3_309), new Uint8Array(0), new Uint8Array(1_952), EMPTY_CONTEXT),
        mlDsa65Verify(new Uint8Array(3_309), detachedBytes(0), new Uint8Array(1_952), EMPTY_CONTEXT),
        mlDsa65Verify(new Uint8Array(3_309), new Uint8Array(0), detachedBytes(1_952), EMPTY_CONTEXT),
        mlDsa65Verify(new Uint8Array(3_309), new Uint8Array(0), new Uint8Array(1_952), detachedBytes(0))
      ]

      yield* Effect.forEach(verifications, (verification) =>
        failureTag(verification).pipe(
          Effect.map((tag) => expect(tag).toBe("InvalidVerificationInput"))
        ), { discard: true })
    }))

  it.effect("hedged signing fails with SigningFailed for detached and uncopyable inputs without throwing", () =>
    Effect.gen(function*() {
      const keys = yield* generateKeyPair("ml-dsa-65")
      const signings = [
        mlDsa65SignHedged(detachedBytes(0), keys.secretKey, keys.publicKey, EMPTY_CONTEXT, new Uint8Array(32)),
        mlDsa65SignHedged(new Uint8Array(3), detachedBytes(4_032), keys.publicKey, EMPTY_CONTEXT, new Uint8Array(32)),
        mlDsa65SignHedged(new Uint8Array(3), keys.secretKey, detachedBytes(1_952), EMPTY_CONTEXT, new Uint8Array(32)),
        mlDsa65SignHedged(new Uint8Array(3), keys.secretKey, keys.publicKey, detachedBytes(0), new Uint8Array(32)),
        mlDsa65SignHedged(new Uint8Array(3), keys.secretKey, keys.publicKey, EMPTY_CONTEXT, detachedBytes(32)),
        mlDsa65SignHedged(uncopyableBytes(3), keys.secretKey, keys.publicKey, EMPTY_CONTEXT, new Uint8Array(32))
      ]

      yield* Effect.forEach(signings, (signing) =>
        Effect.flip(signing).pipe(
          Effect.map((error) => {
            expect(error._tag).toBe("SigningFailed")
            expect(error.reason).toBe("invalid input")
          })
        ), { discard: true })
    }))

  it.effect("rejects message bound plus one before every direct primitive", () =>
    Effect.gen(function*() {
      const excessMessage = new Uint8Array(DIRECT_VERIFICATION_MAX_MESSAGE_BYTES + 1)
      expect(yield* failureTag(ed25519Verify(new Uint8Array(64), excessMessage, new Uint8Array(32))))
        .toBe("InvalidVerificationInput")
      expect(
        yield* failureTag(
          p256Sha256P1363LowSVerify(new Uint8Array(64), excessMessage, new Uint8Array(65))
        )
      ).toBe("InvalidVerificationInput")
      expect(
        yield* failureTag(
          mlDsa65Verify(new Uint8Array(3_309), excessMessage, new Uint8Array(1_952), EMPTY_CONTEXT)
        )
      ).toBe("InvalidVerificationInput")
    }))
})
