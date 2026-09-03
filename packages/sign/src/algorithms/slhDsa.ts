/**
 * Implements four stateless SHA2-based SLH-DSA suites from FIPS 205 through
 * `@noble/post-quantum`.
 *
 * @remarks
 * The 128f suite uses 32-byte public keys, 64-byte secret keys, and
 * 17,088-byte signatures. The 128s suite uses the same key sizes and
 * 7,856-byte signatures. The 192f suite uses 48, 96, and 35,664 bytes; the
 * 256f suite uses 64, 128, and 49,856 bytes. Signing and key generation use
 * Noble's default randomness behavior. Backend exceptions are represented by
 * `SigningFailed` or `VerificationFailed`; admitted nonmatches return `false`.
 *
 * @since 0.1.0
 * @category algorithms
 */
import {
  slh_dsa_sha2_128f,
  slh_dsa_sha2_128s,
  slh_dsa_sha2_192f,
  slh_dsa_sha2_256f
} from "@noble/post-quantum/slh-dsa.js"
import { makePqOps } from "../internal/pqSignatureOps.js"

const sha2128f = makePqOps("slh-dsa-sha2-128f", slh_dsa_sha2_128f)
const sha2128s = makePqOps("slh-dsa-sha2-128s", slh_dsa_sha2_128s)
const sha2192f = makePqOps("slh-dsa-sha2-192f", slh_dsa_sha2_192f)
const sha2256f = makePqOps("slh-dsa-sha2-256f", slh_dsa_sha2_256f)

/**
 * Produces a 17,088-byte Level 1 fast SLH-DSA signature over exact message bytes.
 *
 * @remarks
 * The result stores the supplied public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128fSign = sha2128f.sign

/**
 * Verifies a Level 1 fast SLH-DSA-SHA2-128f signature (17,088 bytes).
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128fVerify = sha2128f.verify

/**
 * Generates a Level 1 fast SLH-DSA key pair with 32-byte public and 64-byte secret keys.
 *
 * @remarks
 * Key generation uses Noble's ambient CSPRNG.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128fKeygen = sha2128f.keygen

/**
 * Produces a 7,856-byte Level 1 small SLH-DSA signature over exact message bytes.
 *
 * @remarks
 * The result stores the supplied public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128sSign = sha2128s.sign

/**
 * Verifies a Level 1 small SLH-DSA-SHA2-128s signature (7,856 bytes).
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128sVerify = sha2128s.verify

/**
 * Generates a Level 1 small-signature SLH-DSA key pair with 32-byte public and 64-byte secret keys.
 *
 * @remarks
 * Key generation uses Noble's ambient CSPRNG.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128sKeygen = sha2128s.keygen

/**
 * Produces a 35,664-byte Level 3 fast SLH-DSA signature over exact message bytes.
 *
 * @remarks
 * The result stores the supplied public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2192fSign = sha2192f.sign

/**
 * Verifies a Level 3 fast SLH-DSA-SHA2-192f signature (35,664 bytes).
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2192fVerify = sha2192f.verify

/**
 * Generates a Level 3 fast SLH-DSA key pair with 48-byte public and 96-byte secret keys.
 *
 * @remarks
 * Key generation uses Noble's ambient CSPRNG.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2192fKeygen = sha2192f.keygen

/**
 * Produces a 49,856-byte Level 5 fast SLH-DSA signature over exact message bytes.
 *
 * @remarks
 * The result stores the supplied public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2256fSign = sha2256f.sign

/**
 * Verifies a Level 5 fast SLH-DSA-SHA2-256f signature (49,856 bytes).
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2256fVerify = sha2256f.verify

/**
 * Generates a Level 5 fast SLH-DSA key pair with 64-byte public and 128-byte secret keys.
 *
 * @remarks
 * Key generation uses Noble's ambient CSPRNG.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2256fKeygen = sha2256f.keygen
