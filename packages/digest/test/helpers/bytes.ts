import { Hex } from "effect/encoding"
/**
 * Byte conversions for test vectors: hex golden vectors into `Uint8Array`,
 * fixture text into UTF-8 bytes, and the runtime's own UTF-8 bytes as an
 * oracle independent of the package's encoder.
 *
 * @internal
 * @since 0.1.0
 * @category test-helpers
 */
import { Effect, Schema, Stream } from "effect"

/**
 * Encode known well-formed fixture text as UTF-8 bytes.
 *
 * Use the package's strict public encoder in tests that exercise text
 * behavior. This helper exists only to prepare fixed, known-well-formed
 * cryptographic vectors through Effect's independent encoder.
 *
 * @since 0.3.0
 * @category test-helpers
 */
export const encodeFixtureUtf8 = (text: string): Uint8Array =>
  Schema.decodeSync(Schema.Uint8ArrayFromHex)(Hex.encode(text))

/**
 * The runtime's own UTF-8 bytes for `text`, reached through Effect's
 * `Stream.encodeText`. It is the oracle the package encoder's laws are checked
 * against byte for byte, so it deliberately does not go through the package.
 *
 * @since 0.3.0
 * @category test-helpers
 */
export const oracleUtf8 = (text: string): Effect.Effect<Uint8Array, Schema.SchemaError> =>
  Stream.encodeText(Stream.make(text)).pipe(
    Stream.flatMap(Stream.fromIterable),
    Stream.runCollect,
    Effect.map((bytes) => Uint8Array.from(bytes))
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
export const bytesToHex = (bytes: Uint8Array): string => Hex.encode(bytes)
