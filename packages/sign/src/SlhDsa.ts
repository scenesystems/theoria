/**
 * SHA2-based SLH-DSA signature operations.
 * FIPS 205 pure signatures over exact message bytes with an empty context.
 * Signing and key generation require Entropy.Entropy; verification does not.
 * Signers copy inputs on each execution before requesting entropy and store the
 * captured supplied public key without pair validation.
 * Nonmatches return false; exceptions become Signature.SigningFailed or
 * Signature.VerificationFailed with diagnostics. Key failures are
 * KeyPair.GenerationFailed. Primitive execution is synchronous and can be costly.
 *
 * @since 0.5.0
 * @module
 */
import {
  slh_dsa_sha2_128f,
  slh_dsa_sha2_128s,
  slh_dsa_sha2_192f,
  slh_dsa_sha2_256f
} from "@noble/post-quantum/slh-dsa.js"
import { makePqOps } from "./internal/pqSignatureOps.js"

const sha2128f = makePqOps("slh-dsa-sha2-128f", slh_dsa_sha2_128f, 48, 16)
const sha2128s = makePqOps("slh-dsa-sha2-128s", slh_dsa_sha2_128s, 48, 16)
const sha2192f = makePqOps("slh-dsa-sha2-192f", slh_dsa_sha2_192f, 72, 24)
const sha2256f = makePqOps("slh-dsa-sha2-256f", slh_dsa_sha2_256f, 96, 32)

/**
 * Signs with SLH-DSA-SHA2-128f.
 * Requires 16 fresh entropy bytes; a 64-byte secret key produces 17,088 bytes.
 *
 * @since 0.5.0
 * @category signing
 */
export const signSha2128f = sha2128f.sign

/**
 * Verifies SLH-DSA-SHA2-128f.
 * Checks a 17,088-byte signature with a 32-byte public key and empty context.
 *
 * @since 0.5.0
 * @category verification
 */
export const verifySha2128f = sha2128f.verify

/**
 * Generates an SLH-DSA-SHA2-128f key pair.
 * Draws 48 entropy bytes, producing a 32-byte public and 64-byte secret key.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateSha2128fKeyPair = sha2128f.keygen

/**
 * Signs with SLH-DSA-SHA2-128s.
 * Requires 16 fresh entropy bytes; a 64-byte secret key produces 7,856 bytes.
 *
 * @since 0.5.0
 * @category signing
 */
export const signSha2128s = sha2128s.sign

/**
 * Verifies SLH-DSA-SHA2-128s.
 * Checks a 7,856-byte signature with a 32-byte public key and empty context.
 *
 * @since 0.5.0
 * @category verification
 */
export const verifySha2128s = sha2128s.verify

/**
 * Generates an SLH-DSA-SHA2-128s key pair.
 * Draws 48 entropy bytes, producing a 32-byte public and 64-byte secret key.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateSha2128sKeyPair = sha2128s.keygen

/**
 * Signs with SLH-DSA-SHA2-192f.
 * Requires 24 fresh entropy bytes; a 96-byte secret key produces 35,664 bytes.
 *
 * @since 0.5.0
 * @category signing
 */
export const signSha2192f = sha2192f.sign

/**
 * Verifies SLH-DSA-SHA2-192f.
 * Checks a 35,664-byte signature with a 48-byte public key and empty context.
 *
 * @since 0.5.0
 * @category verification
 */
export const verifySha2192f = sha2192f.verify

/**
 * Generates an SLH-DSA-SHA2-192f key pair.
 * Draws 72 entropy bytes, producing a 48-byte public and 96-byte secret key.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateSha2192fKeyPair = sha2192f.keygen

/**
 * Signs with SLH-DSA-SHA2-256f.
 * Requires 32 fresh entropy bytes; a 128-byte secret key produces 49,856 bytes.
 *
 * @since 0.5.0
 * @category signing
 */
export const signSha2256f = sha2256f.sign

/**
 * Verifies SLH-DSA-SHA2-256f.
 * Checks a 49,856-byte signature with a 64-byte public key and empty context.
 *
 * @since 0.5.0
 * @category verification
 */
export const verifySha2256f = sha2256f.verify

/**
 * Generates an SLH-DSA-SHA2-256f key pair.
 * Draws 96 entropy bytes, producing a 64-byte public and 128-byte secret key.
 *
 * @since 0.5.0
 * @category keys
 */
export const generateSha2256fKeyPair = sha2256f.keygen
