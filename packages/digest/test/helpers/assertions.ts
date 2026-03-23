/**
 * Shared assertion helpers for Effect-native crypto testing.
 *
 * All helpers are pure functions operating on vitest's expect API.
 * No Effect wrapping needed — these are synchronous assertions
 * called within test bodies.
 *
 * @since 0.1.0
 * @category test-helpers
 */
import { expect } from "@effect/vitest"
import { bytesToHex } from "./bytes.js"

/**
 * Assert a Uint8Array digest matches an expected hex string vector.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const expectDigest = (result: Uint8Array, expectedHex: string): void => {
  expect(bytesToHex(result)).toBe(expectedHex)
}

/**
 * Assert a Uint8Array has exactly `n` bytes.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const expectByteLength = (result: Uint8Array, n: number): void => {
  expect(result).toBeInstanceOf(Uint8Array)
  expect(result.length).toBe(n)
}

/**
 * Assert a base64url string matches expected value.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const expectBase64Url = (result: string, expected: string): void => {
  expect(result).toBe(expected)
}
