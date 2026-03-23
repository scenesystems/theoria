/**
 * Shared test keys for seal algorithm tests.
 *
 * All keys are deterministic constants — no randomness in test
 * fixtures. Every algorithm requires exactly 32-byte keys.
 *
 * @since 0.1.0
 * @category test-helpers
 */

import { utf8ToBytes } from "@noble/ciphers/utils.js"

/**
 * Valid 32-byte key filled with incrementing bytes.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const validKey = Uint8Array.from({ length: 32 }, (_, i) => i)

/**
 * A different valid 32-byte key for wrong-key tests.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const wrongKey = Uint8Array.from({ length: 32 }, (_, i) => 255 - i)

/**
 * Invalid 16-byte key — too short.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const shortKey = new Uint8Array(16).fill(0xaa)

/**
 * Invalid 64-byte key — too long.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const longKey = new Uint8Array(64).fill(0xbb)

/**
 * Simple plaintext for round-trip tests.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const plaintext = utf8ToBytes("hello, seal!")
