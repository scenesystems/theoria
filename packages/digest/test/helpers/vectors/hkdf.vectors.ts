/**
 * HKDF golden test vectors from RFC 5869.
 *
 * Verified against Python `hmac` + manual extract/expand and
 * cross-checked with the RFC appendix.
 *
 * @since 0.1.0
 * @category test-helpers
 */

/**
 * RFC 5869 HKDF-SHA256 test cases.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hkdfSha256Vectors = {
  /** Case 1: basic test case */
  case1: {
    ikm: new Uint8Array(22).fill(0x0b),
    salt: Uint8Array.from({ length: 13 }, (_, i) => i),
    info: Uint8Array.from({ length: 10 }, (_, i) => 0xf0 + i),
    length: 42,
    prk: "077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5",
    okm: "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"
  },
  /** Case 2: longer inputs */
  case2: {
    ikm: Uint8Array.from({ length: 80 }, (_, i) => i),
    salt: Uint8Array.from({ length: 80 }, (_, i) => 0x60 + i),
    info: Uint8Array.from({ length: 80 }, (_, i) => 0xb0 + i),
    length: 82,
    okm:
      "b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87"
  },
  /** Case 3: zero-length salt and info */
  case3: {
    ikm: new Uint8Array(22).fill(0x0b),
    salt: undefined,
    info: new Uint8Array(0),
    length: 42,
    okm: "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8"
  }
}
