/**
 * Golden test vectors for convenience digest and HMAC functions.
 *
 * Verified against `@noble/hashes` direct output and cross-checked
 * with `openssl dgst` / Python `hmac` module.
 *
 * @since 0.1.0
 * @category test-helpers
 */

/**
 * digestBytes / digestUtf8 base64url golden vectors.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const digestBase64UrlVectors = {
  blake3: {
    hello: "6o8WPbOGgpJeRJHF5Y1Ls1Bu-MFOt4qG6QjFYkpnIA8",
    empty: "rxNJufX5oaagQE3qNtzJSZvLJcmtwRK3zJqTyuQfMmI",
    abc: "ZDezrDhGUTP_tjt1JzqNtUjFWEZdedsD_TWcbNW9nYU"
  },
  sha256: {
    hello: "LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ",
    empty: "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
    abc: "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
  }
}

/**
 * hmacSha256Base64Url golden vectors.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hmacSha256Base64UrlVectors = {
  /** RFC 4231 case 1: 20×0x0b key, "Hi There" */
  case1: {
    key: new Uint8Array(20).fill(0x0b),
    message: new TextEncoder().encode("Hi There"),
    expected: "sDRMYdjbOFNcqK_OrwvxK4gdwgDJgz2nJuk3bC4yz_c"
  },
  /** Webhook scenario: "webhook-secret" key, JSON payload */
  webhook: {
    key: new TextEncoder().encode("webhook-secret"),
    message: new TextEncoder().encode("{\"event\":\"charge.succeeded\"}"),
    expected: "QKyLcVVtnNlI3gUbfE-hfsyvzPO3yUH0kx-3jKWqkfo"
  }
}

/**
 * hmacSha1Hex golden vectors.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hmacSha1HexVectors = {
  /** RFC 2202 case 1: 20×0x0b key, "Hi There" */
  case1: {
    key: new Uint8Array(20).fill(0x0b),
    message: new TextEncoder().encode("Hi There"),
    expected: "b617318655057264e28bc0b6fb378c8ef146be00"
  },
  /** RFC 2202 case 2: "Jefe" key, "what do ya want for nothing?" */
  case2: {
    key: new TextEncoder().encode("Jefe"),
    message: new TextEncoder().encode("what do ya want for nothing?"),
    expected: "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79"
  }
}
