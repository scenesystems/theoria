/**
 * Canonical persisted-key identity delegated to `@scenesystems/digest`.
 *
 * @since 0.1.0
 */
import { durableFingerprint as _durableFingerprint } from "@scenesystems/digest"

import type { CanonicalizationError } from "@scenesystems/digest"
import type { Effect } from "effect"

/**
 * Canonicalizes a portable encoded key and computes its BLAKE3-256 identity.
 *
 * @remarks
 * The preimage passes through JCS canonicalization, UTF-8 encoding, BLAKE3-256,
 * and base64url encoding. Unsupported values, invalid Unicode, cycles, and other
 * canonicalization failures remain in `CanonicalizationError`.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const durableFingerprint: (value: unknown) => Effect.Effect<string, CanonicalizationError> = _durableFingerprint
