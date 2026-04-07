# @scenesystems/sign

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Digital signatures, key agreement, and key encapsulation for [Effect](https://effect.website). Classical and post-quantum algorithms, built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem.

## Installation

```sh
npm install @scenesystems/sign
# or
pnpm add @scenesystems/sign
# or
bun add @scenesystems/sign
```

Requires `effect` ≥ 3.20.0 as a peer dependency.

## Why this package?

Digital signatures prove who sent a message. Key agreement lets two parties derive a shared secret. Key encapsulation does the same thing but with quantum resistance. `@scenesystems/sign` provides all three families through a single Effect-native API with typed errors, self-describing output types, and exhaustive algorithm dispatch — from Ed25519 to post-quantum ML-DSA and the XWing hybrid KEM.

- **Ed25519 + secp256k1** — classical signatures for general use and blockchain compatibility
- **ML-DSA + SLH-DSA** — NIST post-quantum signatures (FIPS 204/205) at multiple security levels
- **X25519** — elliptic-curve Diffie–Hellman key agreement
- **XWing** — hybrid KEM combining X25519 + ML-KEM-768 for quantum-resistant key transport
- **Portable codecs** — schema-backed base64url carriers for `KeyPair`, `Signature`, `SharedSecret`, and `KemCiphertext`
- **Detached signatures** — portable proofs with explicit-key verification and base64url-safe transport helpers
- **Batch verification** — order-preserving per-item verification outcomes over mixed self-describing and detached carriers

## Algorithms

### Signatures

| Algorithm           | Family          | Standard | Security | Signature size | Status |
| ------------------- | --------------- | -------- | -------- | -------------- | ------ |
| `ed25519`           | EdDSA           | RFC 8032 | 128-bit  | 64 B           | Stable |
| `secp256k1-ecdsa`   | ECDSA           | RFC 6979 | 128-bit  | 64 B           | Stable |
| `secp256k1-schnorr` | Schnorr         | BIP-340  | 128-bit  | 64 B           | Stable |
| `ml-dsa-44`         | Lattice (PQ)    | FIPS 204 | NIST 2   | 2,420 B        | Stable |
| `ml-dsa-65`         | Lattice (PQ)    | FIPS 204 | NIST 3   | 3,309 B        | Stable |
| `ml-dsa-87`         | Lattice (PQ)    | FIPS 204 | NIST 5   | 4,627 B        | Stable |
| `slh-dsa-sha2-128f` | Hash-based (PQ) | FIPS 205 | NIST 1   | ~7,856 B       | Stable |
| `slh-dsa-sha2-128s` | Hash-based (PQ) | FIPS 205 | NIST 1   | ~7,856 B       | Stable |
| `slh-dsa-sha2-192f` | Hash-based (PQ) | FIPS 205 | NIST 3   | ~16,224 B      | Stable |
| `slh-dsa-sha2-256f` | Hash-based (PQ) | FIPS 205 | NIST 5   | ~29,792 B      | Stable |

### Key agreement

| Algorithm | Family | Standard | Security | Shared secret | Status |
| --------- | ------ | -------- | -------- | ------------- | ------ |
| `x25519`  | ECDH   | RFC 7748 | 128-bit  | 32 B          | Stable |

### Key encapsulation (KEM)

| Algorithm | Family          | Standard                | Security  | Ciphertext | Status |
| --------- | --------------- | ----------------------- | --------- | ---------- | ------ |
| `xwing`   | X25519 + ML-KEM | X-Wing / CFRG hybrid KEM | Hybrid PQ | ~1,121 B   | Stable |

### Choosing an algorithm

Use **Ed25519** for general-purpose signing — it's fast, widely supported, and deterministic.

Use **secp256k1** when interacting with Bitcoin, Ethereum, or other blockchain systems.

Use **ML-DSA-65** if you need post-quantum signatures today. It's the NIST-recommended parameter set (FIPS 204) with a good balance of security and size.

Use **SLH-DSA** when you want conservative post-quantum security that doesn't rely on lattice hardness — it's based purely on hash functions. Signing is slow (1–5 seconds), so it's best suited for infrequent operations like certificate issuance.

Use **XWing** KEM for quantum-resistant key establishment. It combines X25519 and ML-KEM-768 — an attacker must break both to recover the shared secret.

## Quick start

```ts typecheck
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
| `signDetached(algorithm, message, secretKey, publicKey)` | Sign a message → `Effect<DetachedSignature>` |
| `verifyDetached(signature, message, publicKey)` | Verify a detached signature with explicit key → `Effect<boolean>` |
| `batchVerify(requests)` | Verify mixed self-describing and detached requests → `Effect<BatchVerifyReport>` |

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

### Portable codecs

| Function                         | Description                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| `encodeKeyPair(keyPair)`         | Convert `KeyPair` to `PortableKeyPair`                             |
| `decodeKeyPair(value)`           | Decode `PortableKeyPair` → `Effect<KeyPair, PortableCodecDecodeFailed>` |
| `encodeSignature(signature)`     | Convert `Signature` to `PortableSignature`                         |
| `decodeSignature(value)`         | Decode `PortableSignature` → `Effect<Signature, PortableCodecDecodeFailed>` |
| `encodeSharedSecret(secret)`     | Convert `SharedSecret` to `PortableSharedSecret`                   |
| `decodeSharedSecret(value)`      | Decode `PortableSharedSecret` → `Effect<SharedSecret, PortableCodecDecodeFailed>` |
| `encodeKemCiphertext(ciphertext)` | Convert `KemCiphertext` to `PortableKemCiphertext`                |
| `decodeKemCiphertext(value)`     | Decode `PortableKemCiphertext` → `Effect<KemCiphertext, PortableCodecDecodeFailed>` |

### Encoding utilities

| Function                 | Description                                  |
| ------------------------ | -------------------------------------------- |
| `utf8ToBytes(str)`       | Convert a UTF-8 string to `Uint8Array`       |
| `toHex(bytes)`           | Encode bytes to lowercase hex string         |
| `toBase64Url(bytes)`     | Encode bytes to base64url without padding    |
| `fromBase64Url(encoded)` | Decode base64url text to `Uint8Array` safely |
| `equalBytes(a, b)`       | Constant-time byte array comparison          |

### Schema types

| Type                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `SignatureAlgorithm` | 10 signature algorithm literals                          |
| `AgreementAlgorithm` | `"x25519"`                                               |
| `KemAlgorithm`       | `"xwing"`                                                |
| `Signature`          | Schema.Class — `algorithm`, `signature`, `publicKey`     |
| `PortableKeyPair`    | Schema.Class — base64url-safe `KeyPair` carrier          |
| `PortableSignature`  | Schema.Class — base64url-safe `Signature` carrier        |
| `PortableSharedSecret` | Schema.Class — base64url-safe `SharedSecret` carrier   |
| `PortableKemCiphertext` | Schema.Class — base64url-safe `KemCiphertext` carrier |
| `DetachedSignature`  | Schema.Class — `algorithm`, `signature`                  |
| `BatchVerifySignatureRequest` | Schema.Class — self-describing batch item        |
| `BatchVerifyDetachedSignatureRequest` | Schema.Class — detached batch item with explicit key |
| `BatchVerifyReport`  | Schema.Class — aggregate counts plus ordered results     |
| `SharedSecret`       | Schema.Class — `algorithm`, `sharedSecret`               |
| `KemCiphertext`      | Schema.Class — `algorithm`, `ciphertext`, `sharedSecret` |
| `KeyPair`            | Schema.Class — `algorithm`, `publicKey`, `secretKey`     |

### Errors

| Error                 | Raised by         | Description                          |
| --------------------- | ----------------- | ------------------------------------ |
| `SigningFailed`       | `sign`            | Signing operation failed             |
| `VerificationFailed`  | `verify`          | Signature is valid but doesn't match |
| `InvalidSignature`    | `verify`          | Signature data is malformed          |
| `PortableCodecDecodeFailed` | `decode*`   | Portable carrier failed schema or base64url decoding |
| `KeyGenerationFailed` | `generateKeyPair` | Key generation failed                |

## Examples

Runnable example files:

- [`examples/01-sign-verify.ts`](./examples/01-sign-verify.ts) — Ed25519 signing and tamper detection
- [`examples/02-key-agreement.ts`](./examples/02-key-agreement.ts) — X25519 shared-secret derivation
- [`examples/03-post-quantum.ts`](./examples/03-post-quantum.ts) — ML-DSA signatures plus XWing KEM
- [`examples/04-detached-signature.ts`](./examples/04-detached-signature.ts) — detached signatures with base64url public-key transport
- [`examples/05-batch-verify.ts`](./examples/05-batch-verify.ts) — mixed self-describing and detached batch verification
- [`examples/06-key-codecs.ts`](./examples/06-key-codecs.ts) — portable codec workflows for signing artifacts and X25519 shared secrets

### Portable codec workflows

```ts
import {
  decodeKeyPair,
  decodeSharedSecret,
  decodeSignature,
  deriveSharedSecret,
  encodeKeyPair,
  encodeSharedSecret,
  encodeSignature,
  equalBytes,
  generateKeyPair,
  sign,
  utf8ToBytes,
  verify
} from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const signingKeys = yield* generateKeyPair("ed25519")
  const portableKeys = encodeKeyPair(signingKeys)
  const restoredKeys = yield* decodeKeyPair(portableKeys)
  const message = utf8ToBytes("portable signature")
  const signature = yield* sign("ed25519", message, restoredKeys.secretKey, restoredKeys.publicKey)
  const portableSignature = encodeSignature(signature)
  const restoredSignature = yield* decodeSignature(portableSignature)

  const alice = yield* generateKeyPair("x25519")
  const bob = yield* generateKeyPair("x25519")
  const sharedSecret = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
  const portableSharedSecret = encodeSharedSecret(sharedSecret)
  const restoredSharedSecret = yield* decodeSharedSecret(portableSharedSecret)

  return {
    keysRoundTrip: equalBytes(signingKeys.publicKey, restoredKeys.publicKey),
    signatureRoundTrip: yield* verify(restoredSignature, message),
    sharedSecretRoundTrip: equalBytes(sharedSecret.sharedSecret, restoredSharedSecret.sharedSecret)
  }
})
```

The portable carriers stay JSON-safe and base64url-safe while preserving the
same algorithm discrimination as the in-memory `KeyPair`, `Signature`,
`SharedSecret`, and `KemCiphertext` classes. That keeps artifact exchange safe
for downstream chat, workflow, and storage boundaries.

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

### Detached sign and verify

```ts
import {
  fromBase64Url,
  generateKeyPair,
  signDetached,
  toBase64Url,
  utf8ToBytes,
  verifyDetached
} from "@scenesystems/sign"
import { Effect, Either } from "effect"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("release artifact v1")

  const detached = yield* signDetached("ed25519", message, keys.secretKey, keys.publicKey)
  const encodedPublicKey = toBase64Url(keys.publicKey)

  const decodedPublicKey = yield* Either.match(fromBase64Url(encodedPublicKey), {
    onLeft: () => Effect.fail("invalid-public-key"),
    onRight: Effect.succeed
  })

  const valid = yield* verifyDetached(detached, message, decodedPublicKey)
  // true
})
```

### Batch verify mixed carriers

```ts
import {
  BatchVerifyDetachedSignatureRequest,
  BatchVerifySignatureRequest,
  batchVerify,
  generateKeyPair,
  sign,
  signDetached,
  utf8ToBytes
} from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const ed25519 = yield* generateKeyPair("ed25519")
  const secp256k1 = yield* generateKeyPair("secp256k1-ecdsa")

  const releaseMessage = utf8ToBytes("release artifact")
  const policyMessage = utf8ToBytes("security policy")

  const signedRelease = yield* sign("ed25519", releaseMessage, ed25519.secretKey, ed25519.publicKey)
  const signedPolicy = yield* signDetached(
    "secp256k1-ecdsa",
    policyMessage,
    secp256k1.secretKey,
    secp256k1.publicKey
  )

  const report = yield* batchVerify([
    new BatchVerifySignatureRequest({
      kind: "self-describing",
      message: releaseMessage,
      signature: signedRelease
    }),
    new BatchVerifyDetachedSignatureRequest({
      kind: "detached",
      message: policyMessage,
      signature: signedPolicy,
      publicKey: secp256k1.publicKey
    })
  ])

  // report.allValid === true
  // report.results preserve input order and per-item outcomes
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

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
