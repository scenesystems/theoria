/**
 * Cryptographically secure random bytes for hedged signing.
 *
 * @remarks
 * `mlDsa65SignHedged` never consults ambient randomness; callers must supply
 * exactly 32 fresh random bytes. This module is the package's Effect-native
 * source for that entropy. It reads the platform CSPRNG through Noble and
 * deliberately does not use Effect's seedable `Random` service, which is a
 * deterministic PRNG and unsuitable for key or signature entropy.
 *
 * @since 0.3.0
 * @category keys
 * @module
 */

import { randomBytes as _randomBytes } from "@noble/hashes/utils.js"
import { Effect } from "effect"

import { EntropyGenerationFailed } from "./schemas/errors.js"

/**
 * Number of entropy bytes that hedged ML-DSA signing requires.
 *
 * @since 0.3.0
 * @category keys
 */
export const HEDGED_SIGNING_ENTROPY_BYTES = 32

/**
 * Obtains random bytes from the runtime cryptographic random source.
 *
 * @remarks
 * The default length is the 32 bytes that `mlDsa65SignHedged` accepts. The
 * source rejects a length that is not a safe non-negative integer or exceeds
 * the platform's per-call limit (65,536 bytes), and a runtime without
 * `crypto.getRandomValues`; each fails with {@link EntropyGenerationFailed}.
 *
 * @param length - Number of bytes to generate; defaults to 32.
 * @returns Newly allocated random bytes produced when the effect executes.
 *
 * @since 0.3.0
 * @category keys
 */
export const generateEntropy = (
  length: number = HEDGED_SIGNING_ENTROPY_BYTES
): Effect.Effect<Uint8Array, EntropyGenerationFailed> =>
  Effect.try({
    try: () => _randomBytes(length),
    catch: (cause) => new EntropyGenerationFailed({ length, reason: String(cause) })
  })
