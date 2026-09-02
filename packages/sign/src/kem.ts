/**
 * Encapsulates and decapsulates raw shared secrets with X-Wing.
 *
 * X-Wing combines X25519 and ML-KEM-768. It does not authenticate the
 * recipient or sender, and callers must apply protocol-specific key derivation
 * before using the shared secret as a symmetric key.
 *
 * @since 0.1.0
 * @category kem
 */
import type { Effect } from "effect"
import { Match } from "effect"
import { xwingDecapsulate, xwingEncapsulate } from "./algorithms/hybrid.js"
import type { KemFailed } from "./schemas/errors.js"
import type { KemAlgorithm } from "./schemas/KemAlgorithm.js"
import type { KemCiphertext } from "./schemas/KemCiphertext.js"

type KemAlgorithmType = typeof KemAlgorithm.Type

/**
 * Encapsulates a shared secret for a recipient's public key.
 *
 * @remarks
 * The returned `sharedSecret` belongs to the sender; transmit only the returned
 * `ciphertext`. XWing does not authenticate the recipient key.
 *
 * @param algorithm - The KEM suite; currently only `"xwing"`.
 * @param publicKey - The recipient's XWing public key.
 * @returns The ciphertext and sender-owned raw shared secret, or
 * `KemFailed` if the key is rejected or encapsulation cannot execute.
 *
 * @since 0.1.0
 * @category kem
 */
export const encapsulate = (
  algorithm: KemAlgorithmType,
  publicKey: Uint8Array
): Effect.Effect<KemCiphertext, KemFailed> =>
  Match.value(algorithm).pipe(
    Match.when("xwing", () => xwingEncapsulate(publicKey)),
    Match.exhaustive
  )

/**
 * Decapsulates a ciphertext with the recipient's secret key.
 *
 * @param algorithm - The KEM suite; currently only `"xwing"`.
 * @param cipherText - The complete XWing ciphertext received from the sender.
 * @param secretKey - The recipient's XWing secret key.
 * @returns The raw shared-secret bytes, or `KemFailed` if
 * the ciphertext or key is rejected or decapsulation cannot execute.
 *
 * @since 0.1.0
 * @category kem
 */
export const decapsulate = (
  algorithm: KemAlgorithmType,
  cipherText: Uint8Array,
  secretKey: Uint8Array
): Effect.Effect<Uint8Array, KemFailed> =>
  Match.value(algorithm).pipe(
    Match.when("xwing", () => xwingDecapsulate(cipherText, secretKey)),
    Match.exhaustive
  )
