/**
 * Hashes the same UTF-8 message with BLAKE3 and SHA-256, compares the one-shot
 * helper with the explicit byte pipeline, and logs base64url and hexadecimal
 * encodings.
 *
 * Run: bun run examples/01-content-hashing.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { blake3Hash, digestUtf8, encodeUtf8, sha256, toBase64Url, toHex } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const message = "hello, content hashing!"
  const bytes = yield* encodeUtf8(message)

  const blake3Digest = yield* blake3Hash(bytes)
  const blake3B64 = toBase64Url(blake3Digest)
  const blake3HexStr = toHex(blake3Digest)
  yield* Effect.log("BLAKE3", { base64url: blake3B64, hex: blake3HexStr })

  const sha256Digest = yield* sha256(bytes)
  const sha256B64 = toBase64Url(sha256Digest)
  const sha256HexStr = toHex(sha256Digest)
  yield* Effect.log("SHA-256", { base64url: sha256B64, hex: sha256HexStr })

  yield* Effect.log("Algorithm comparison", { sameOutput: blake3B64 === sha256B64 })

  const shortcutBlake3 = yield* digestUtf8("blake3-256", message)
  const shortcutB64 = toBase64Url(shortcutBlake3)
  yield* Effect.log("digestUtf8 BLAKE3 parity", { matches: shortcutB64 === blake3B64 })

  const shortcutSha256 = yield* digestUtf8("sha256", message)
  const shortcutSha256B64 = toBase64Url(shortcutSha256)
  yield* Effect.log("digestUtf8 SHA-256 parity", { matches: shortcutSha256B64 === sha256B64 })
})

BunRuntime.runMain(program)
