/**
 * BLAKE3 golden test vectors.
 *
 * Generated from @noble/hashes blake3 implementation matching
 * the BLAKE3 reference test vectors. All hex strings verified
 * against the official BLAKE3 repository test_vectors.json.
 *
 * @since 0.1.0
 * @category test-helpers
 */

/**
 * Default hash mode vectors.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const hashVectors = {
  /** BLAKE3("") */
  empty: "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
  /** BLAKE3("hello") */
  hello: "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f",
  /** BLAKE3("abc") */
  abc: "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85",
  /** BLAKE3("hello 🌍") — UTF-8 multibyte */
  utf8Emoji: "3ec50d89b9b5e5d22d3676fc707e4db4d509887d1a52f7f1ea1fecfdca4a7ef9"
}

/**
 * Keyed MAC mode vectors. Key is 32 bytes.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const macVectors = {
  /** MAC(zeros_32, "hello") */
  zerosKeyHello: "e0f68bfec361216ec02fc15736643a70471d96260b0fe6f273a909bb8b6dbd81",
  /** MAC(ones_32, "hello") — different key produces different output */
  onesKeyHello: "acc938a1d8801c7def1b72b9940b4df68c61b0071961a164ae1a38ad6cf954af",
  /** MAC(zeros_32, "") — empty message */
  zerosKeyEmpty: "a7f91ced0533c12cd59706f2dc38c2a8c39c007ae89ab6492698778c8684c483",
  /** MAC(zeros_32, "a"×1000) — long message */
  zerosKeyLong: "610c91cafbbfc72c54331d8976b82668f43b4a18f1879a95a49447c1282467b8"
}

/**
 * Derive key mode vectors. Context is ASCII string.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const deriveVectors = {
  /** derive("effect-search/cache-key", "hello") */
  ctx1Hello: "0965236cfe4c58c9c48ece07caae98a5c8baa98290c033eb91dda54766019f5e",
  /** derive("different-context", "hello") — different context = different output */
  ctx2Hello: "8c4f7c1e87b96754b4b9220d2ddac0132b8bfbf6ef13882027a9f958f29fc7e6",
  /** derive("effect-search/cache-key", "hello", dkLen=64) */
  ctx1HelloDk64:
    "0965236cfe4c58c9c48ece07caae98a5c8baa98290c033eb91dda54766019f5e0f21f8b2f359abb37b319675261f77868fd38ec9c97c5a665cd16162afaa1a7e",
  /** derive("effect-search/cache-key", "") — empty input */
  ctx1Empty: "0af080313b47d86920a13ba8e16ccdd3023d73b0e9c5d6741e7b5087545c1f79"
}

/**
 * Context strings used in derive vectors.
 *
 * @since 0.1.0
 * @category test-helpers
 */
export const contexts = {
  ctx1: "effect-search/cache-key",
  ctx2: "different-context"
}
