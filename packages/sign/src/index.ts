/**
 * @scenesystems/sign — digital signatures, key agreement, and key
 * encapsulation for Effect.
 *
 * Three cryptographic families — signatures, key agreement, and key
 * encapsulation — each with separate pipelines and algorithm types.
 *
 * @example
 * ```ts
 * import { generateKeyPair, sign, utf8ToBytes } from "@scenesystems/sign"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const keys = yield* generateKeyPair("ed25519")
 *   const message = utf8ToBytes("hello")
 *   const sig = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
 *   return sig
 * })
 * ```
 *
 * @see {@link sign} — digital signature pipeline
 * @see {@link agreement} — key agreement pipeline
 * @see {@link kem} — key encapsulation pipeline
 *
 * @since 0.1.0
 * @module
 */

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/ed25519.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/secp256k1.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/x25519.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/mlDsa.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/slhDsa.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/hybrid.js"

/**
 * @since 0.1.0
 * @category signing
 */
export * from "./sign.js"

/**
 * @since 0.1.0
 * @category agreement
 */
export * from "./agreement.js"

/**
 * @since 0.1.0
 * @category kem
 */
export * from "./kem.js"

/**
 * @since 0.1.0
 * @category keys
 */
export * from "./keyPair.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/SignatureAlgorithm.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/AgreementAlgorithm.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/KemAlgorithm.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/KeyPair.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/Signature.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/SharedSecret.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/KemCiphertext.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./schemas/errors.js"

/**
 * @since 0.1.0
 * @category encoding
 */
export * from "./encoding.js"
