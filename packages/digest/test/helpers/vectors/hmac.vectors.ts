/**
 * HMAC golden test vectors.
 *
 * HMAC-SHA256 vectors from RFC 4231 (test cases 1–4).
 * HMAC-SHA1 vectors from RFC 2202 (test cases 1–2).
 * Verified against Python `hmac` module and `openssl dgst`.
 *
 * @since 0.1.0
 * @category test-helpers
 */

/**
 * RFC 4231 HMAC-SHA256 test cases.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hmacSha256Vectors = {
  /** Case 1: 20×0x0b key, "Hi There" */
  case1: {
    key: new Uint8Array(20).fill(0x0b),
    data: new TextEncoder().encode("Hi There"),
    expected: "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
  },
  /** Case 2: "Jefe" key, "what do ya want for nothing?" */
  case2: {
    key: new TextEncoder().encode("Jefe"),
    data: new TextEncoder().encode("what do ya want for nothing?"),
    expected: "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
  },
  /** Case 3: 20×0xaa key, 50×0xdd data */
  case3: {
    key: new Uint8Array(20).fill(0xaa),
    data: new Uint8Array(50).fill(0xdd),
    expected: "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe"
  },
  /** Case 4: 25-byte sequential key (0x01..0x19), 50×0xcd data */
  case4: {
    key: Uint8Array.from({ length: 25 }, (_, i) => i + 1),
    data: new Uint8Array(50).fill(0xcd),
    expected: "82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b"
  }
}

/**
 * RFC 2202 HMAC-SHA1 test cases (legacy compatibility).
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hmacSha1Vectors = {
  /** Case 1: 20×0x0b key, "Hi There" */
  case1: {
    key: new Uint8Array(20).fill(0x0b),
    data: new TextEncoder().encode("Hi There"),
    expected: "b617318655057264e28bc0b6fb378c8ef146be00"
  },
  /** Case 2: "Jefe" key, "what do ya want for nothing?" */
  case2: {
    key: new TextEncoder().encode("Jefe"),
    data: new TextEncoder().encode("what do ya want for nothing?"),
    expected: "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79"
  }
}
