---
"@scenesystems/seal": minor
---

Initial release of `@scenesystems/seal` — authenticated encryption for Effect.

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
