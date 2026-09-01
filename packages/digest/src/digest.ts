/**
 * Algorithm-tagged digests for canonical structured data.
 *
 * The canonical JSON bytes form the hash preimage. The result records the
 * selected digest algorithm beside its unpadded base64url value.
 *
 * @see {@link canonicalize}
 * @see {@link blake3Hash}
 * @see {@link sha256}
 * @see {@link toBase64Url}
 * @see {@link DigestAlgorithm}
 *
 * @since 0.1.0
 * @category digest
 */

import { Effect } from "effect"
import { canonicalize } from "./canonicalize.js"
import { digestBytesTagged } from "./internal/digest-bytes.js"
import { encodeUtf8Unchecked } from "./internal/unicode.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import type { CanonicalizationError } from "./schemas/errors.js"

/**
 * Hashes a value's RFC 8785 encoding and prefixes the digest with its algorithm identifier.
 *
 * @remarks
 * Admitted Unicode is preserved without normalization. Unsupported values,
 * malformed Unicode, and cycles fail before a digest is returned.
 *
 * @param algorithm - Algorithm recorded in and used to produce the result.
 * @param value - Value in the strict canonical plain-data domain.
 * @returns `<algorithm>:<base64url>`, or a canonicalization failure.
 *
 * @since 0.1.0
 * @category digest
 */
export const digest = (
  algorithm: DigestAlgorithm,
  value: unknown
): Effect.Effect<string, CanonicalizationError> =>
  Effect.gen(function*() {
    const canonical = yield* canonicalize(value)
    const bytes = encodeUtf8Unchecked(canonical)
    return yield* digestBytesTagged(algorithm, bytes)
  })
