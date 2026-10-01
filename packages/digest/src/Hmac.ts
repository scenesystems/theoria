/**
 * RFC 2104 HMAC-SHA256 and HMAC-SHA1 message authentication.
 * These pure operations accept raw key/message bytes and return fresh tags.
 * Verification requires constant-time comparison at the protocol boundary.
 * Bind the algorithm, key identity, and message domain in that protocol.
 *
 * @since 0.7.0
 * @module
 */

import { hmac } from "@noble/hashes/hmac.js"
import { sha1 as nobleSha1 } from "@noble/hashes/legacy.js"
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"

/**
 * Computes a 32-byte HMAC-SHA256 authentication tag without modifying inputs.
 * Keys of any byte length are admitted; RFC 2104 hashes long keys and pads
 * shorter ones. Applications remain responsible for adequate key entropy.
 *
 * @since 0.7.0
 * @category authentication
 */
export const sha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => hmac(nobleSha256, key, message)

/**
 * Computes a 20-byte HMAC-SHA1 authentication tag for protocols that require it.
 * Accepts keys of any byte length and does not modify inputs. Prefer SHA-256
 * when the protocol does not mandate SHA-1.
 *
 * @since 0.7.0
 * @category authentication
 */
export const sha1 = (key: Uint8Array, message: Uint8Array): Uint8Array => hmac(nobleSha1, key, message)
