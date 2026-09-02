/**
 * Key serialization between `Uint8Array` and base64url strings.
 *
 * Uses the unpadded URL-safe RFC 4648 alphabet. Encoding is total; decoding
 * returns an `Either` with `DecodeException` for malformed input.
 *
 * @since 0.1.0
 * @internal
 */
import type { Either } from "effect"
import { Encoding } from "effect"

/**
 * Encodes bytes as unpadded base64url.
 *
 * @since 0.1.0
 * @internal
 */
export const toBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes)

/**
 * Decodes unpadded base64url into bytes, returning `DecodeException` on the
 * left for malformed input.
 *
 * @since 0.1.0
 * @internal
 */
export const fromBase64Url = (encoded: string): Either.Either<Uint8Array, Encoding.DecodeException> =>
  Encoding.decodeBase64Url(encoded)
