# @scenesystems/digest

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `@scenesystems/digest` — cryptographic content hashing and canonicalization for Effect.

  ### Hashing algorithms
  - **BLAKE3-256** — primary digest algorithm with hash, keyed MAC, and KDF modes via native BLAKE3 context-based domain separation
  - **SHA-256** — secondary algorithm for interoperability with existing systems and FIPS-compliant environments

  ### Canonicalization
  - **RFC 8785 JCS** deterministic JSON serialization (sorted keys, ES2015 number formatting) for reproducible structured-data hashing across languages and runtimes

  ### Content-addressing pipelines
  - **`digest`** — unified canonicalize → hash → base64url pipeline producing algorithm-tagged strings (`"blake3-256:<base64url>"`)
  - **`digestSchemaValue`** — Schema-aware variant that encodes typed Effect values to their wire form before hashing
  - **`durableFingerprint`** — canonical BLAKE3-256 fingerprint function for cache key identity
  - Convenience functions for common workflows: `digestBytes`, `digestUtf8`, `digestBytesBase64Url`, `digestUtf8Base64Url`, `digestBytesHex`

  ### Message authentication
  - **HMAC-SHA256** and **HMAC-SHA1** (RFC 2104) for webhook signature verification and API key derivation, with pre-composed base64url and hex encoding variants

  ### Key derivation
  - **HKDF-SHA256** and **HKDF-SHA512** (RFC 5869) extract-then-expand key derivation for producing symmetric keys from raw key material

  ### Encoding
  - **base64url** (no padding) and **hex** encoding for digest output

  ### Schema types
  - **`Digest256`** — branded 43-character base64url digest value
  - **`ContentDigest`** — algorithm-tagged digest pair schema
  - **`DigestAlgorithm`** — literal union of supported algorithms

  All cryptographic primitives are built on the [Noble](https://paulmillr.com/noble/) audited ecosystem (`@noble/hashes`). Every operation is Effect-native with typed error channels.
