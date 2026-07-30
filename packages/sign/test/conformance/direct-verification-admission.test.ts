import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { ed25519Verify } from "../../src/algorithms/ed25519.js"
import { mlDsa65Verify } from "../../src/algorithms/mlDsa.js"
import { p256Sha256P1363LowSVerify } from "../../src/algorithms/p256.js"
import { DIRECT_VERIFICATION_MAX_MESSAGE_BYTES } from "../../src/internal/verificationInput.js"
import type { InvalidVerificationInput, VerificationUnavailable } from "../../src/schemas/errors.js"

const EMPTY_CONTEXT = new Uint8Array(0)
type DirectVerification = Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable, never>

const ed25519Contract: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => DirectVerification =
  ed25519Verify
const p256Contract: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => DirectVerification =
  p256Sha256P1363LowSVerify
const mlDsa65Contract: (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
  context: Uint8Array
) => DirectVerification = mlDsa65Verify

const failureTag = <A>(effect: Effect.Effect<A, InvalidVerificationInput | VerificationUnavailable>) =>
  Effect.flip(effect).pipe(Effect.map((error) => error._tag))

const detachedBytes = (byteLength: number): Uint8Array => {
  const buffer = new ArrayBuffer(byteLength)
  const bytes = new Uint8Array(buffer)
  structuredClone(buffer, { transfer: [buffer] })
  return bytes
}

const uncopyableBytes = (byteLength: number): Uint8Array =>
  new Proxy(new Uint8Array(byteLength), {
    get: (target, property) => property === "length" ? target.length : Reflect.get(target, property)
  })

describe("strict direct verification admission", () => {
  it.effect("implements the exact service-free public Effect contracts", () =>
    Effect.sync(() => {
      expect(ed25519Contract).toBe(ed25519Verify)
      expect(p256Contract).toBe(p256Sha256P1363LowSVerify)
      expect(mlDsa65Contract).toBe(mlDsa65Verify)
    }))

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
