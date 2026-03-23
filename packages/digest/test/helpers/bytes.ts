/**
 * Hex-to-bytes conversion for test vectors.
 *
 * Pure utility — no Effect dependency. Converts hex string
 * golden vectors into Uint8Array for comparison with digest
 * output.
 *
 * @internal
 * @since 0.1.0
 * @category test-helpers
 */
import { Array as Arr } from "effect"

/**
 * Convert hex string to Uint8Array.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hexToBytes = (hex: string): Uint8Array => {
  const indices = Arr.range(0, hex.length / 2 - 1)
  const bytes = new Uint8Array(hex.length / 2)
  Arr.forEach(indices, (i: number) => {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  })
  return bytes
}

/**
 * Convert Uint8Array to hex string.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const bytesToHex = (bytes: Uint8Array): string =>
  Arr.fromIterable(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("")
