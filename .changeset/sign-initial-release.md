---
"@scenesystems/sign": minor
---

Initial release of `@scenesystems/sign` — digital signatures, key agreement, and key encapsulation for Effect.

### Signature algorithms

- **Ed25519** — EdDSA signatures (RFC 8032) with 32-byte keys and 64-byte signatures
- **secp256k1 ECDSA** — Ethereum/Bitcoin-compatible ECDSA signatures
- **secp256k1 Schnorr** — BIP-340 Schnorr signatures for Bitcoin Taproot
- **ML-DSA-44/65/87** — FIPS-204 (Dilithium) post-quantum lattice-based signatures at three security levels
- **SLH-DSA-SHA2-128f/128s/192f/256f** — FIPS-205 (SPHINCS+) hash-based post-quantum signatures

### Key agreement

- **X25519** — RFC 7748 elliptic-curve Diffie–Hellman for deriving shared secrets between two parties

### Key encapsulation

- **XWing** — hybrid KEM combining X25519 and ML-KEM-768 for quantum-resistant key transport

### Signing pipeline

- **`sign`** — sign a message with algorithm selection, producing a self-describing `Signature` carrying algorithm tag and public key
- **`verify`** — verify a signature using the algorithm recorded in the signature object
- **`generateKeyPair`** — generate key pairs for any algorithm across all three cryptographic families
- **`deriveSharedSecret`** — X25519 key agreement producing a `SharedSecret`
- **`encapsulate`** / **`decapsulate`** — XWing hybrid KEM for quantum-resistant key exchange

### Schema types

- **`Signature`** — `Schema.Class` with algorithm, signature bytes, and public key
- **`KeyPair`** — `Schema.Class` with algorithm, public key, and secret key
- **`SharedSecret`** — `Schema.Class` for key agreement output
- **`KemCiphertext`** — `Schema.Class` for KEM encapsulation output
- **`SignatureAlgorithm`** / **`AgreementAlgorithm`** / **`KemAlgorithm`** — literal unions enforcing family separation
- **`SigningFailed`** / **`VerificationFailed`** / **`InvalidSignature`** / **`KeyGenerationFailed`** — `Schema.TaggedError` types

### Utilities

- **`utf8ToBytes`** — UTF-8 encoding without reaching into Noble directly
- **`toHex`** — hex encoding for key and signature display
- **`equalBytes`** — constant-time byte comparison preventing timing side-channel attacks

All cryptographic primitives are built on the [Noble](https://paulmillr.com/noble/) audited ecosystem (`@noble/curves`, `@noble/hashes`, `@noble/post-quantum`). Every operation is Effect-native with typed error channels.
