import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Match } from "effect"

import { aesgcmDecrypt, aesgcmEncrypt } from "../../src/algorithms/aesgcm.js"
import { aesgcmsivDecrypt, aesgcmsivEncrypt } from "../../src/algorithms/aesgcmsiv.js"
import { xchacha20Decrypt, xchacha20Encrypt } from "../../src/algorithms/xchacha20.js"
import { packEnvelope } from "../../src/encoding.js"
import { DecryptionFailed } from "../../src/schemas/errors.js"
import { unseal } from "../../src/seal.js"
import { plaintext, validKey } from "../helpers/keys.js"

const associatedData = new Uint8Array([5, 4, 3, 2, 1])
const wrongAssociatedData = new Uint8Array([1, 2, 3, 4, 5])

const encryptRaw = (
  algorithm: "xchacha20-poly1305" | "aes-256-gcm-siv" | "aes-256-gcm"
): (key: Uint8Array, plaintext: Uint8Array, associatedData?: Uint8Array) => Effect.Effect<Uint8Array, unknown> =>
  Match.value(algorithm).pipe(
    Match.when("xchacha20-poly1305", () => xchacha20Encrypt),
    Match.when("aes-256-gcm-siv", () => aesgcmsivEncrypt),
    Match.when("aes-256-gcm", () => aesgcmEncrypt),
    Match.exhaustive
  )

const decryptRaw = (
  algorithm: "xchacha20-poly1305" | "aes-256-gcm-siv" | "aes-256-gcm"
): (key: Uint8Array, ciphertext: Uint8Array, associatedData?: Uint8Array) => Effect.Effect<Uint8Array, unknown> =>
  Match.value(algorithm).pipe(
    Match.when("xchacha20-poly1305", () => xchacha20Decrypt),
    Match.when("aes-256-gcm-siv", () => aesgcmsivDecrypt),
    Match.when("aes-256-gcm", () => aesgcmDecrypt),
    Match.exhaustive
  )

const algorithms: ReadonlyArray<"xchacha20-poly1305" | "aes-256-gcm-siv" | "aes-256-gcm"> = [
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
]

describe("algorithm associated-data contracts", () => {
  it.effect("keeps direct algorithm helpers aligned with the unified pipeline AAD semantics", () =>
    Effect.forEach(
      algorithms,
      (algorithm) =>
        Effect.gen(function*() {
          const rawCiphertext = yield* encryptRaw(algorithm)(validKey, plaintext, associatedData)
          const directRecovered = yield* decryptRaw(algorithm)(validKey, rawCiphertext, associatedData)
          const envelope = yield* packEnvelope(algorithm, rawCiphertext)
          const unifiedRecovered = yield* unseal(validKey, envelope, associatedData)
          const wrongExit = yield* Effect.exit(decryptRaw(algorithm)(validKey, rawCiphertext, wrongAssociatedData))

          expect(directRecovered).toEqual(plaintext)
          expect(unifiedRecovered).toEqual(plaintext)
          expect(wrongExit).toStrictEqual(
            Exit.fail(
              new DecryptionFailed({
                algorithm,
                reason: "authentication failed"
              })
            )
          )
        }),
      { discard: true }
    ))
})
