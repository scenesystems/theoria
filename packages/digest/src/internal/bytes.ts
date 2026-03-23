/**
 * Low-level byte manipulation utilities.
 *
 * Wraps `@noble/hashes/utils.js` utilities (`bytesToHex`,
 * `hexToBytes`, `concatBytes`) and provides UTF-8 string-to-bytes
 * conversion via `TextEncoder`. Noble v2 requires `Uint8Array`
 * input for all hash functions — strings must be converted first.
 *
 * Private to the package — consumers use the public API.
 *
 * @internal
 */

import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js"

export { bytesToHex, concatBytes, hexToBytes, utf8ToBytes }
