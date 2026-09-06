/**
 * Byte conversions for test vectors: hex golden vectors into `Uint8Array`,
 * fixture text into UTF-8 bytes, and UTF-8 bytes back into text through an
 * oracle independent of the package's encoder.
 *
 * @internal
 * @since 0.1.0
 * @category test-helpers
 */
import type { Effect } from "effect"
import { Array as Arr, Stream } from "effect"

import { encodeUtf8Unchecked } from "../../src/internal/unicode.js"

/**
 * Encode known well-formed fixture text as UTF-8 bytes.
 *
 * Use the public effectful encoder in tests that exercise text behavior. This
 * helper exists only to prepare fixed raw-byte cryptographic vectors, so it
 * uses the package's unchecked encoder directly.
 *
 * @since 0.3.0
 * @category test-helpers
 */
export const encodeFixtureUtf8 = (text: string): Uint8Array => encodeUtf8Unchecked(text)

/**
 * Decode UTF-8 bytes with the runtime's decoder, reached through Effect's
 * `Stream.decodeText`. It is the oracle the encoder's round-trip laws are
 * checked against, so it deliberately does not go through the package.
 *
 * @since 0.3.0
 * @category test-helpers
 */
export const decodeUtf8 = (bytes: Uint8Array): Effect.Effect<string> =>
  Stream.decodeText(Stream.make(bytes)).pipe(Stream.mkString)

/**
 * Convert hex string to Uint8Array.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hexToBytes = (hex: string): Uint8Array => {
  const indices = Arr.range(0, hex.length / 2 - 1)
  const bytes = new Uint8Array(hex.length / 2)
  Arr.forEach(indices, (i: number) => {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  })
  return bytes
}

/**
 * Convert Uint8Array to hex string.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const bytesToHex = (bytes: Uint8Array): string =>
  Arr.fromIterable(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("")
