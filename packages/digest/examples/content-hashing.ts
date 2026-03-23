/**
 * Content Hashing — core hashing workflows with @scenesystems/digest.
 *
 * Demonstrates:
 * - `blake3Hash` with `utf8ToBytes` for raw byte hashing
 * - `sha256` for FIPS compatibility
 * - `digestUtf8` as a convenience shortcut
 * - `toBase64Url` and `toHex` for encoding output
 * - Different algorithms produce different output
 *
 * Run: bun run examples/content-hashing.ts
 *
 * @since 0.1.0
 */

import { BunRuntime } from "@effect/platform-bun"
import { blake3Hash, digestUtf8, sha256, toBase64Url, toHex, utf8ToBytes } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const message = "hello, content hashing!"
  const bytes = utf8ToBytes(message)

  const blake3Digest = yield* blake3Hash(bytes)
  const blake3B64 = yield* toBase64Url(blake3Digest)
  const blake3HexStr = yield* toHex(blake3Digest)
  yield* Effect.log("BLAKE3", { base64url: blake3B64, hex: blake3HexStr })

  const sha256Digest = yield* sha256(bytes)
  const sha256B64 = yield* toBase64Url(sha256Digest)
  const sha256HexStr = yield* toHex(sha256Digest)
  yield* Effect.log("SHA-256", { base64url: sha256B64, hex: sha256HexStr })

  yield* Effect.log("Algorithm comparison", { sameOutput: blake3B64 === sha256B64 })

  const shortcutBlake3 = yield* digestUtf8("blake3-256", message)
  const shortcutB64 = yield* toBase64Url(shortcutBlake3)
  yield* Effect.log("digestUtf8 BLAKE3 parity", { matches: shortcutB64 === blake3B64 })

  const shortcutSha256 = yield* digestUtf8("sha256", message)
  const shortcutSha256B64 = yield* toBase64Url(shortcutSha256)
  yield* Effect.log("digestUtf8 SHA-256 parity", { matches: shortcutSha256B64 === sha256B64 })
})

BunRuntime.runMain(program)
