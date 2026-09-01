/**
 * Key encapsulation mechanism (KEM) pipeline.
 *
 * Provides hybrid key encapsulation combining classical and
 * post-quantum algorithms.
 *
 * ```
 * Recipient's public key
 *   → encapsulate (X25519 + ML-KEM-768)
 *   → { ciphertext, sharedSecret }
 *
 * Ciphertext + Recipient's secret key
 *   → decapsulate
 *   → sharedSecret (identical)
 * ```
 *
 * The shared secret should be passed through a KDF before use as
 * a symmetric key.
 *
 * **Authentication warning**: KEM is not authenticated by itself.
 * An attacker can substitute their own public key (MITM). Always
 * pair with authenticated identity keys or signatures.
 *
 * @see {@link hybrid} — the underlying XWing algorithm
 * @see {@link agreement} — classical key agreement (X25519 only)
 * @see {@link sign} — digital signature pipeline
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
 * Encapsulate a shared secret for a recipient's public key.
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
 * Decapsulate a ciphertext with the recipient's secret key.
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
