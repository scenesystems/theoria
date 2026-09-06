/**
 * Signs and verifies messages, derives X25519 shared secrets, and performs
 * X-Wing key encapsulation in Effect programs.
 *
 * @example
 * ```ts
 * import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"
 * import { Effect } from "effect"
 *
 * export const program = Effect.gen(function* () {
 *   const keys = yield* generateKeyPair("ed25519")
 *   const message = utf8ToBytes("hello")
 *   const signature = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
 *   return yield* verify(signature, message).pipe(
 *     Effect.filterOrFail(
 *       (verified) => verified,
 *       () => "SignatureDidNotVerify"
 *     )
 *   )
 * })
 * ```
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
 * @since 0.1.1
 * @category algorithms
 */
export * from "./algorithms/p256.js"

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
 * @since 0.3.0
 * @category keys
 */
export * from "./entropy.js"

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
