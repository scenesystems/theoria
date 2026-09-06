/**
 * BLAKE3-256 fingerprints for canonical structured-data identity.
 *
 * @remarks
 * Values must already be in the package's canonical plain-data domain. Encode
 * richer values through their Schema before calling this operation. The result
 * uses the wire form `"blake3-256:<base64url>"`.
 *
 * @see {@link canonicalize}
 * @see {@link blake3Hash}
 * @see {@link CanonicalizationError}
 * @see {@link ContentDigest}
 *
 * @since 0.1.0
 * @category fingerprint
 * @module
 */

import type { Effect } from "effect"
import { digest } from "../digest.js"
import type { CanonicalizationError } from "./errors.js"

/**
 * Computes a BLAKE3-256 identity from a value's RFC 8785 encoding.
 *
 * @remarks
 * The result uses `"blake3-256:<base64url>"` so stored keys retain their
 * algorithm identifier.
 *
 * @param value - Schema-encoded value in the strict canonical plain-data domain.
 * @returns The tagged fingerprint, or a canonicalization failure.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const durableFingerprint = (
  value: unknown
): Effect.Effect<string, CanonicalizationError> => digest("blake3-256", value)
