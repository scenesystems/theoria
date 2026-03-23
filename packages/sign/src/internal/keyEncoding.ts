/**
 * Key serialization and deserialization utilities.
 *
 * Handles encoding/decoding of public and secret keys between
 * `Uint8Array` (runtime) and string representations (persistence,
 * transport). Supports base64url (primary, URL-safe) and hex
 * (debugging, compatibility).
 *
 * Uses `@noble/hashes/utils.js` for hex conversion and standard
 * `TextEncoder`/`TextDecoder` for UTF-8. Base64url encoding follows
 * RFC 4648 §5 (no padding).
 *
 * Private to the package — consumers use Schema encoding/decoding
 * or the public key pair API.
 *
 * @internal
 */
