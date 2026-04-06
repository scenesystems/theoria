/**
 * Detached Signatures — portable signature plus explicit public-key transport.
 *
 * What this shows: the detached signature carrier keeps the public key outside
 * the artifact. The example signs a message, transports the public key through
 * base64url, decodes it, and verifies the detached proof explicitly.
 *
 * Run: bun run examples/04-detached-signature.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { Effect, Either } from "effect"

import {
  fromBase64Url,
  generateKeyPair,
  signDetached,
  toBase64Url,
  utf8ToBytes,
  verifyDetached
} from "@scenesystems/sign"

const decodeBase64Url = (encoded: string) =>
  Either.match(fromBase64Url(encoded), {
    onLeft: (error) => Effect.die(`invalid base64url transport: ${error.message}`),
    onRight: Effect.succeed
  })

const program = Effect.gen(function*() {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("portable detached proof")

  const detached = yield* signDetached("ed25519", message, keys.secretKey, keys.publicKey)
  const encodedPublicKey = toBase64Url(keys.publicKey)
  const decodedPublicKey = yield* decodeBase64Url(encodedPublicKey)
  const valid = yield* verifyDetached(detached, message, decodedPublicKey)

  yield* Effect.log("Detached signature", {
    algorithm: detached.algorithm,
    signatureBytes: detached.signature.length,
    encodedPublicKey,
    verified: valid
  })
})

BunRuntime.runMain(program)
