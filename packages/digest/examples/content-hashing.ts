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
 */

import { blake3Hash, digestUtf8, sha256, toBase64Url, toHex, utf8ToBytes } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const message = "hello, content hashing!"
  const bytes = utf8ToBytes(message)

  // --- Raw byte hashing with BLAKE3 ---
  const blake3Digest = yield* blake3Hash(bytes)
  const blake3B64 = yield* toBase64Url(blake3Digest)
  const blake3HexStr = yield* toHex(blake3Digest)
  console.log("BLAKE3 base64url:", blake3B64)
  console.log("BLAKE3 hex:      ", blake3HexStr)

  // --- SHA-256 for FIPS compatibility ---
  const sha256Digest = yield* sha256(bytes)
  const sha256B64 = yield* toBase64Url(sha256Digest)
  const sha256HexStr = yield* toHex(sha256Digest)
  console.log("SHA256 base64url:", sha256B64)
  console.log("SHA256 hex:      ", sha256HexStr)

  // --- Different algorithms produce different output ---
  console.log("Same output?", blake3B64 === sha256B64 ? "yes" : "no (expected)")

  // --- digestUtf8: convenience shortcut (string → hash bytes) ---
  const shortcutBlake3 = yield* digestUtf8("blake3-256", message)
  const shortcutB64 = yield* toBase64Url(shortcutBlake3)
  console.log("digestUtf8 matches blake3Hash?", shortcutB64 === blake3B64 ? "yes" : "no")

  // --- digestUtf8 with SHA-256 ---
  const shortcutSha256 = yield* digestUtf8("sha256", message)
  const shortcutSha256B64 = yield* toBase64Url(shortcutSha256)
  console.log("digestUtf8 matches sha256?    ", shortcutSha256B64 === sha256B64 ? "yes" : "no")
})

Effect.runPromise(program)
