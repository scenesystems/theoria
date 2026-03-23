/**
 * Durable cache-key fingerprinting delegated to `@scenesystems/digest`.
 *
 * @since 0.1.0
 */
import { durableFingerprint as _durableFingerprint } from "@scenesystems/digest"

import type { FingerprintUnsupportedValue } from "@scenesystems/digest"
import type { Effect } from "effect"

/**
 * Deterministic, durable fingerprint string for cache key identity.
 *
 * Delegates to `@scenesystems/digest`'s canonical BLAKE3-256
 * fingerprint: JCS canonicalization → UTF-8 → BLAKE3-256 → base64url.
 *
 * The preimage must already be schema-encoded into a portable JSON shape.
 *
 * @since 0.1.0
 * @category utils
 */
export const durableFingerprint: (value: unknown) => Effect.Effect<string, FingerprintUnsupportedValue> =
  _durableFingerprint
