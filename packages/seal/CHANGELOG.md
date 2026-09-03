# @scenesystems/seal

## 0.2.2

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

## 0.2.1

### Patch Changes

- [#68](https://github.com/scenesystems/theoria/pull/68) [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Publish the rewritten package README with a clearer account of the package's purpose, use, and place in Theoria.

## 0.2.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `@scenesystems/seal` — authenticated encryption for Effect.

  ### AEAD algorithms
  - **XChaCha20-Poly1305** — recommended default with 192-bit nonces eliminating nonce-reuse risk in high-volume encryption
  - **AES-256-GCM-SIV** — nonce-misuse resistant alternative for contexts where nonce uniqueness cannot be guaranteed
  - **AES-256-GCM** — compatibility option for interoperability with systems that require AES-GCM

  ### Encryption pipeline
  - **`seal`** — encrypt plaintext with algorithm selection, producing a self-describing `SealedEnvelope` carrying algorithm, nonce, and ciphertext
  - **`unseal`** — decrypt a `SealedEnvelope` using the algorithm recorded in the envelope, enabling algorithm-agnostic storage and key rotation
  - Key validation before cipher invocation with typed `InvalidKey` errors carrying expected and received lengths

  ### Schema types
  - **`SealedEnvelope`** — `Schema.Class` with algorithm identifier, base64url nonce, and base64url ciphertext (authentication tag appended by Noble)
  - **`SealAlgorithm`** — literal union of supported algorithms
  - **`DecryptionFailed`** / **`InvalidKey`** — `Schema.TaggedError` types for typed error channels

  ### Utilities
  - **`generateKey`** — CSPRNG key generation via `@noble/ciphers` (`crypto.getRandomValues`)
  - **`utf8ToBytes`** / **`utf8FromBytes`** — UTF-8 encoding without reaching into Noble directly
  - **`equalBytes`** — constant-time byte comparison preventing timing side-channel attacks

  All cryptographic primitives are built on the [Noble](https://paulmillr.com/noble/) audited ecosystem (`@noble/ciphers`). Every operation is Effect-native with typed error channels.
