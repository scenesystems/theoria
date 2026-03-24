/**
 * Key serialization between `Uint8Array` and base64url strings.
 *
 * Handles encoding/decoding of public and secret keys for
 * persistence and transport. URL-safe alphabet: `A-Z a-z 0-9 - _`
 * (no `+` `/` `=`), per RFC 4648 §5.
 *
 * Uses Effect `Encoding` module — native Effect, no external
 * dependencies. Consistent with the encoding pattern in
 * `@scenesystems/digest` and `@scenesystems/seal`.
 *
 * Encode is pure (cannot fail). Decode returns `Either` — left
 * for malformed input.
 *
 * @see {@link KeyPair} — structured key pair consuming these encoders
 *
 * @since 0.1.0
 * @internal
 */
import type { Either } from "effect"
import { Encoding } from "effect"

/**
 * Encode a `Uint8Array` key to a base64url string (no padding).
 *
 * Pure operation — encoding cannot fail.
 *
 * @since 0.1.0
 * @internal
 */
export const toBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes)

/**
 * Decode a base64url string (no padding) to a `Uint8Array` key.
 *
 * Returns `Either` — left for malformed input.
 *
 * @since 0.1.0
 * @internal
 */
export const fromBase64Url = (encoded: string): Either.Either<Uint8Array, Encoding.DecodeException> =>
  Encoding.decodeBase64Url(encoded)
