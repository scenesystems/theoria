/**
 * Fixture digest authority helper — computes BLAKE3-256 hashes at test
 * time using `@scenesystems/digest` to verify manifest integrity.
 *
 * No hardcoded hashes. The test itself is the authority.
 *
 * @since 0.1.0
 * @category test helpers
 */
import { digest } from "@scenesystems/digest"

import { Effect } from "effect"

/**
 * Computes the canonical BLAKE3-256 digest of a parsed fixture value
 * using the `@scenesystems/digest` pipeline:
 * JCS canonicalize → UTF-8 encode → BLAKE3-256 → base64url → tagged string.
 *
 * Returns `"blake3-256:<base64url>"`.
 */
export const computeFixtureHash = (fixtureContent: unknown): Effect.Effect<string> =>
  digest("blake3-256", fixtureContent).pipe(
    Effect.orDie
  )
