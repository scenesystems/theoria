/**
 * Byte conversions for test vectors: hex golden vectors into `Uint8Array`,
 * fixture text into UTF-8 bytes, and the runtime's own UTF-8 bytes as an
 * oracle independent of the package's encoder.
 *
 * @internal
 * @since 0.1.0
 * @category test-helpers
 */
import { Chunk, Effect, Encoding, type ParseResult, Schema, Stream } from "effect"

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
 * The runtime's own UTF-8 bytes for `text`, reached through Effect's
 * `Stream.encodeText`. It is the oracle the package encoder's laws are checked
 * against byte for byte, so it deliberately does not go through the package.
 *
 * @since 0.3.0
 * @category test-helpers
 */
export const oracleUtf8 = (text: string): Effect.Effect<Uint8Array, ParseResult.ParseError> =>
  Stream.encodeText(Stream.make(text)).pipe(
    Stream.flatMap(Stream.fromIterable),
    Stream.runCollect,
    Effect.flatMap((bytes) => Schema.decode(Schema.Uint8Array)(Chunk.toReadonlyArray(bytes)))
  )

/**
 * Decode a trusted fixture's hexadecimal bytes. Invalid checked-in fixture
 * text is a test-setup error, not an application decoding result.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hexToBytes = Schema.decodeSync(Schema.Uint8ArrayFromHex)

/**
 * Convert Uint8Array to hex string.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const bytesToHex = (bytes: Uint8Array): string => Encoding.encodeHex(bytes)
