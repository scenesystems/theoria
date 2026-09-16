/**
 * Canonical persisted-key identity delegated to `@scenesystems/digest`.
 *
 * @since 0.1.0
 */
import type * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Effect } from "effect"

/**
 * Canonicalizes a portable encoded key and computes its BLAKE3-256 identity.
 *
 * @remarks
 * The preimage passes through JCS canonicalization, UTF-8 encoding, BLAKE3-256,
 * and base64url encoding. Unsupported values, invalid Unicode, cycles, and other
 * canonicalization failures remain in `CanonicalJson.Error`.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const durableFingerprint = (value: unknown): Effect.Effect<string, CanonicalJson.Error> =>
  ContentDigest.fromUnknown("blake3-256", value).pipe(Effect.map(ContentDigest.toString))
