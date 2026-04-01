# @scenesystems/digest

## 0.2.0

### Minor Changes

- [#16](https://github.com/scenesystems/theoria/pull/16) [`4651634`](https://github.com/scenesystems/theoria/commit/46516347d9c73308cfb7ea65ab98eae77537f3be) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add canonical JSON digest helper APIs for one-call RFC 8785 JCS + hash workflows.

  New exports include `digestCanonicalJsonBytes`, `digestCanonicalJsonBase64Url`, and `digestCanonicalJsonHex`, which preserve canonicalization error semantics while removing repeated `canonicalize + utf8ToBytes + digest` boilerplate.

- [#15](https://github.com/scenesystems/theoria/pull/15) [`3c3e316`](https://github.com/scenesystems/theoria/commit/3c3e316dd563bb684338e521e9e0e953b872c329) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add streaming digest APIs for chunked hashing workflows in Effect applications.

  New exports include `digestByteStream`, `digestUtf8Stream`, `digestUtf8StreamBase64Url`, `digestUtf8StreamHex`, `digestByteStreamBase64Url`, and `digestByteStreamHex`, enabling incremental hashing over `Stream` inputs while preserving one-shot digest parity and encoded-output consistency.

  This release also adds `DigestStreaming` and `DigestStreamingLive` so streaming helpers can be injected via Effect layers, and ensures repeated execution of the same streaming digest effect remains safe.

### Patch Changes

- [#13](https://github.com/scenesystems/theoria/pull/13) [`774c14c`](https://github.com/scenesystems/theoria/commit/774c14c0a27d05c01109ac496fd15b9efeb8d922) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Improve digest fixture governance and conformance coverage with deterministic fixture lifecycle tooling, external vector provenance validation, runtime parity fixtures, and clearer mismatch diagnostics for conformance failures.

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
