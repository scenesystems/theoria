/**
 * SHA-256 golden test vectors.
 *
 * Verified against NIST FIPS 180-4 and `shasum -a 256` on macOS.
 * All hex strings are lowercase, 64 characters (256 bits).
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
export const sha256Vectors = {
  /** SHA-256("") — NIST FIPS 180-4 empty string */
  empty: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  /** SHA-256("abc") — NIST FIPS 180-4 one-block message */
  abc: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  /** SHA-256("hello") */
  hello: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  /** SHA-256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq") — NIST two-block message */
  twoBlock: "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  /** SHA-256("hello 🌍") — UTF-8 multibyte */
  utf8Emoji: "92de6bbfa52e6cfa0f85916fd8176cb1644b95a4c0148cdda94745ba6c35e5eb"
}
