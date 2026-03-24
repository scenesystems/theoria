# @scenesystems/sign

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Digital signatures, key agreement, and key encapsulation for [Effect](https://effect.website). Classical and post-quantum algorithms, built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem.

## Install

```sh
bun add @scenesystems/sign
```

Requires `effect` ≥ 3.20.0 as a peer dependency.

## Why this package?

Digital signatures prove who sent a message. Key agreement lets two parties derive a shared secret. Key encapsulation does the same thing but with quantum resistance. `@scenesystems/sign` provides all three families through a single Effect-native API with typed errors, self-describing output types, and exhaustive algorithm dispatch — from Ed25519 to post-quantum ML-DSA and the XWing hybrid KEM.

- **Ed25519 + secp256k1** — classical signatures for general use and blockchain compatibility
- **ML-DSA + SLH-DSA** — NIST post-quantum signatures (FIPS 204/205) at multiple security levels
- **X25519** — elliptic-curve Diffie–Hellman key agreement
- **XWing** — hybrid KEM combining X25519 + ML-KEM-768 for quantum-resistant key transport

## Algorithms

### Signatures

| Algorithm           | Family          | Security | Signature size | Use case                       |
| ------------------- | --------------- | -------- | -------------- | ------------------------------ |
| `ed25519`           | EdDSA           | 128-bit  | 64 B           | General purpose, fast          |
| `secp256k1-ecdsa`   | ECDSA           | 128-bit  | 64 B           | Bitcoin/Ethereum compatibility |
| `secp256k1-schnorr` | Schnorr         | 128-bit  | 64 B           | Taproot/batch verification     |
| `ml-dsa-44`         | Lattice (PQ)    | NIST 2   | 2,420 B        | Post-quantum, smallest         |
| `ml-dsa-65`         | Lattice (PQ)    | NIST 3   | 3,309 B        | Post-quantum, recommended      |
| `ml-dsa-87`         | Lattice (PQ)    | NIST 5   | 4,627 B        | Post-quantum, highest security |
| `slh-dsa-sha2-128f` | Hash-based (PQ) | NIST 1   | ~7,856 B       | Post-quantum, fast signing     |
| `slh-dsa-sha2-128s` | Hash-based (PQ) | NIST 1   | ~7,856 B       | Post-quantum, small signatures |
| `slh-dsa-sha2-192f` | Hash-based (PQ) | NIST 3   | ~16,224 B      | Post-quantum, higher security  |
| `slh-dsa-sha2-256f` | Hash-based (PQ) | NIST 5   | ~29,792 B      | Post-quantum, maximum security |

### Key agreement

| Algorithm | Family | Security | Shared secret |
| --------- | ------ | -------- | ------------- |
| `x25519`  | ECDH   | 128-bit  | 32 B          |

### Key encapsulation (KEM)

| Algorithm | Family          | Security  | Ciphertext |
| --------- | --------------- | --------- | ---------- |
| `xwing`   | X25519 + ML-KEM | Hybrid PQ | ~1,121 B   |

### Choosing an algorithm

Use **Ed25519** for general-purpose signing — it's fast, widely supported, and deterministic.

Use **secp256k1** when interacting with Bitcoin, Ethereum, or other blockchain systems.

Use **ML-DSA-65** if you need post-quantum signatures today. It's the NIST-recommended parameter set (FIPS 204) with a good balance of security and size.

Use **SLH-DSA** when you want conservative post-quantum security that doesn't rely on lattice hardness — it's based purely on hash functions. Signing is slow (1–5 seconds), so it's best suited for infrequent operations like certificate issuance.

Use **XWing** KEM for quantum-resistant key establishment. It combines X25519 and ML-KEM-768 — an attacker must break both to recover the shared secret.

## Quick start

```ts
import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("hello, signatures!")

  const sig = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  const valid = yield* verify(sig, message)
  // true
})
```

## API

### Signing

| Function                                         | Description                                            |
| ------------------------------------------------ | ------------------------------------------------------ |
| `sign(algorithm, message, secretKey, publicKey)` | Sign a message → `Effect<Signature>`                   |
| `verify(signature, message)`                     | Verify a self-describing signature → `Effect<boolean>` |

### Key agreement

| Function                                              | Description                          |
| ----------------------------------------------------- | ------------------------------------ |
| `deriveSharedSecret(algorithm, secretKey, publicKey)` | X25519 ECDH → `Effect<SharedSecret>` |

### Key encapsulation

| Function                                        | Description                           |
| ----------------------------------------------- | ------------------------------------- |
| `encapsulate(algorithm, publicKey)`             | Encapsulate → `Effect<KemCiphertext>` |
| `decapsulate(algorithm, ciphertext, secretKey)` | Decapsulate → `Effect<Uint8Array>`    |

### Key generation

| Function                     | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `generateKeyPair(algorithm)` | Generate keys for any algorithm → `Effect<KeyPair>` |

### Encoding utilities

| Function           | Description                            |
| ------------------ | -------------------------------------- |
| `utf8ToBytes(str)` | Convert a UTF-8 string to `Uint8Array` |
| `toHex(bytes)`     | Encode bytes to lowercase hex string   |
| `equalBytes(a, b)` | Constant-time byte array comparison    |

### Schema types

| Type                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `SignatureAlgorithm` | 10 signature algorithm literals                          |
| `AgreementAlgorithm` | `"x25519"`                                               |
| `KemAlgorithm`       | `"xwing"`                                                |
| `Signature`          | Schema.Class — `algorithm`, `signature`, `publicKey`     |
| `SharedSecret`       | Schema.Class — `algorithm`, `sharedSecret`               |
| `KemCiphertext`      | Schema.Class — `algorithm`, `ciphertext`, `sharedSecret` |
| `KeyPair`            | Schema.Class — `algorithm`, `publicKey`, `secretKey`     |

### Errors

| Error                 | Raised by         | Description                          |
| --------------------- | ----------------- | ------------------------------------ |
| `SigningFailed`       | `sign`            | Signing operation failed             |
| `VerificationFailed`  | `verify`          | Signature is valid but doesn't match |
| `InvalidSignature`    | `verify`          | Signature data is malformed          |
| `KeyGenerationFailed` | `generateKeyPair` | Key generation failed                |

## Examples

### Sign and verify

```ts
import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("transfer 100 tokens")

  const sig = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  const valid = yield* verify(sig, message)

  // Tampered message fails verification
  const tampered = utf8ToBytes("transfer 999 tokens")
  const invalid = yield* verify(sig, tampered)
  // false
})
```

### Key agreement with X25519

```ts
import { deriveSharedSecret, generateKeyPair } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const alice = yield* generateKeyPair("x25519")
  const bob = yield* generateKeyPair("x25519")

  // Both sides derive the same shared secret
  const secretA = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
  const secretB = yield* deriveSharedSecret("x25519", bob.secretKey, alice.publicKey)
  // secretA.sharedSecret deep-equals secretB.sharedSecret
})
```

### Post-quantum KEM with XWing

```ts
import { decapsulate, encapsulate, generateKeyPair } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Recipient generates a hybrid key pair
  const recipient = yield* generateKeyPair("xwing")

  // Sender encapsulates a shared secret for the recipient
  const { ciphertext, sharedSecret: senderSecret } = yield* encapsulate("xwing", recipient.publicKey)

  // Recipient decapsulates to recover the same shared secret
  const recipientSecret = yield* decapsulate("xwing", ciphertext, recipient.secretKey)
  // senderSecret deep-equals recipientSecret
})
```

### Post-quantum signatures

```ts
import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // ML-DSA-65 — NIST FIPS 204, recommended parameter set
  const keys = yield* generateKeyPair("ml-dsa-65")
  const message = utf8ToBytes("quantum-resistant document")

  const sig = yield* sign("ml-dsa-65", message, keys.secretKey, keys.publicKey)
  const valid = yield* verify(sig, message)
  // true — verified with post-quantum security
})
```

### Error handling

```ts
import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519").pipe(
    Effect.catchTag("KeyGenerationFailed", (e) => Effect.die(`keygen failed: ${e.reason}`))
  )

  const message = utf8ToBytes("hello")
  const sig = yield* sign("ed25519", message, keys.secretKey, keys.publicKey).pipe(
    Effect.catchTag("SigningFailed", (e) => Effect.die(`signing failed: ${e.reason}`))
  )

  const valid = yield* verify(sig, message).pipe(Effect.catchTag("VerificationFailed", (e) => Effect.succeed(false)))
})
```

See the [`examples/`](./examples) directory for complete runnable programs.

## Cryptographic foundations

All primitives wrap the [Noble](https://paulmillr.com/noble/) cryptographic ecosystem — independently audited by Cure53 and Trail of Bits, zero-dependency, high-performance pure JavaScript implementations.

| Dependency            | Audits   | Purpose                                               |
| --------------------- | -------- | ----------------------------------------------------- |
| `@noble/curves`       | 6 audits | Ed25519, secp256k1, X25519                            |
| `@noble/hashes`       | 6 audits | SHA-256/512 for key encoding                          |
| `@noble/post-quantum` | 1 audit  | ML-DSA (FIPS 204), SLH-DSA (FIPS 205), ML-KEM (XWing) |

### Standards

| Algorithm           | Specification                                                             |
| ------------------- | ------------------------------------------------------------------------- |
| Ed25519             | [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)                        |
| X25519              | [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748)                        |
| secp256k1           | [SEC 2 §2.4.1](https://www.secg.org/sec2-v2.pdf)                          |
| Schnorr (secp256k1) | [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) |
| ML-DSA              | [NIST FIPS 204](https://doi.org/10.6028/NIST.FIPS.204)                    |
| SLH-DSA             | [NIST FIPS 205](https://doi.org/10.6028/NIST.FIPS.205)                    |
| ML-KEM (via XWing)  | [NIST FIPS 203](https://doi.org/10.6028/NIST.FIPS.203)                    |
| XWing               | [Barbosa et al. (2024)](https://doi.org/10.62056/a3qj89n4e)               |

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
