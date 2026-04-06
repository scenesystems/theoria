# @scenesystems/seal

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Authenticated encryption for [Effect](https://effect.website). Built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem.

## Installation

```sh
npm install @scenesystems/seal
# or
pnpm add @scenesystems/seal
# or
bun add @scenesystems/seal
```

Requires `effect` ≥ 3.20.0 as a peer dependency.

## Why this package?

Symmetric encryption is easy to get wrong. Nonce reuse destroys AES-GCM security. Forgetting to authenticate ciphertext enables padding oracles. Rolling your own envelope format invites truncation attacks. `@scenesystems/seal` eliminates these pitfalls with a single `seal`/`unseal` API that handles nonce generation, authentication, and self-describing envelopes — all with typed errors in Effect.

- **XChaCha20-Poly1305** — recommended default. 192-bit random nonce eliminates nonce-reuse risk even at high volume
- **AES-256-GCM-SIV** — nonce-misuse resistant. Safe even if nonces repeat (leaks only equality, not plaintext)
- **AES-256-GCM** — widely deployed AEAD for systems that require AES compatibility
- **Envelope key metadata** — optional `keyId` and `keyVersion` hints for key selection and rotation workflows

### Choosing an algorithm

Use **XChaCha20-Poly1305** unless you have a specific reason not to. Its 192-bit nonce can be generated randomly without collision risk — you never need a nonce counter or database sequence. This makes it the safest default for application-level encryption.

Use **AES-256-GCM-SIV** when you need defense against nonce reuse (e.g., encrypting in stateless or distributed systems where nonce coordination is difficult). It's slightly slower than GCM but survives nonce collisions without catastrophic plaintext leakage.

Use **AES-256-GCM** when interoperating with systems that mandate AES (hardware security modules, FIPS environments, TLS record layers). Be aware that nonce reuse with GCM is catastrophic — the package handles nonce generation for you, but key rotation discipline matters.

## Quick start

```ts typecheck
import { generateKey, seal, unseal, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey(32)
  const message = utf8ToBytes("sensitive data")

  // Encrypt — returns a self-describing SealedEnvelope
  const envelope = yield* seal("xchacha20-poly1305", key, message)

  // Decrypt — reads the algorithm from the envelope
  const recovered = yield* unseal(key, envelope)
})
```

## API

### Core pipeline

| Function                          | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| `seal(algorithm, key, plaintext, metadata?)` | Encrypt and wrap in a `SealedEnvelope`              |
| `unseal(key, envelope)`           | Decrypt a `SealedEnvelope` (algorithm read from it) |

### Direct algorithm access

| Function                            | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `xchacha20Encrypt(key, plaintext)`  | XChaCha20-Poly1305 — recommended         |
| `xchacha20Decrypt(key, ciphertext)` | Decrypt XChaCha20-Poly1305               |
| `aesgcmsivEncrypt(key, plaintext)`  | AES-256-GCM-SIV — nonce-misuse resistant |
| `aesgcmsivDecrypt(key, ciphertext)` | Decrypt AES-256-GCM-SIV                  |
| `aesgcmEncrypt(key, plaintext)`     | AES-256-GCM — compatibility              |
| `aesgcmDecrypt(key, ciphertext)`    | Decrypt AES-256-GCM                      |

### Encoding and key generation

| Function               | Description                                  |
| ---------------------- | -------------------------------------------- |
| `generateKey(length?)` | CSPRNG key generation → `Effect<Uint8Array>` |
| `utf8ToBytes(str)`     | Convert a UTF-8 string to `Uint8Array`       |
| `utf8FromBytes(bytes)` | Convert `Uint8Array` to a UTF-8 string       |
| `equalBytes(a, b)`     | Constant-time byte array comparison          |

### Schema types

| Type             | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `SealAlgorithm`  | `"xchacha20-poly1305" \| "aes-256-gcm-siv" \| "aes-256-gcm"`     |
| `EnvelopeKeyMetadata` | Schema.Struct with optional `keyId` and `keyVersion`       |
| `SealedEnvelope` | Schema.Class with `algorithm`, `nonce` (base64url), `ciphertext`, optional `keyId`, and optional `keyVersion` |

### Errors

| Error              | Raised by        | Description                                        |
| ------------------ | ---------------- | -------------------------------------------------- |
| `InvalidKey`       | `seal`, `unseal` | Key is wrong length (expected 32 bytes)            |
| `DecryptionFailed` | `unseal`         | Authentication failed — wrong key or tampered data |

## Examples

Runnable example files:

- [`examples/01-encrypt-decrypt.ts`](./examples/01-encrypt-decrypt.ts) — baseline envelope round-trip
- [`examples/02-algorithm-comparison.ts`](./examples/02-algorithm-comparison.ts) — compare the three shipped AEAD choices
- [`examples/03-envelope-metadata.ts`](./examples/03-envelope-metadata.ts) — stamp `keyId` and `keyVersion` for key rotation workflows

### Encrypt and decrypt

```ts
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("hello, encryption!")

  const envelope = yield* seal("xchacha20-poly1305", key, plaintext)
  const recovered = yield* unseal(key, envelope)

  const text = utf8FromBytes(recovered)
  // "hello, encryption!"
})
```

### Key rotation metadata

```ts
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("rotate me safely")

  const envelope = yield* seal("xchacha20-poly1305", key, plaintext, {
    keyId: "primary-signing-key",
    keyVersion: 7
  })
  const recovered = yield* unseal(key, envelope)

  return {
    keyId: envelope.keyId,
    keyVersion: envelope.keyVersion,
    text: utf8FromBytes(recovered)
  }
})
```

`keyId` and `keyVersion` are transport-only envelope hints. They help callers
select the right key material before decryption, but they are not cryptographically authenticated and must not be treated as trusted security claims on their own.

### Algorithm comparison

```ts
import { generateKey, seal, unseal, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey(32)
  const data = utf8ToBytes("test payload")

  // All three algorithms produce interchangeable envelopes
  const xchacha = yield* seal("xchacha20-poly1305", key, data)
  const gcmsiv = yield* seal("aes-256-gcm-siv", key, data)
  const gcm = yield* seal("aes-256-gcm", key, data)

  // unseal reads the algorithm from the envelope — no dispatch needed
  const r1 = yield* unseal(key, xchacha)
  const r2 = yield* unseal(key, gcmsiv)
  const r3 = yield* unseal(key, gcm)
})
```

### Error handling

```ts
import { generateKey, seal, unseal, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey(32)
  const wrongKey = yield* generateKey(32)
  const data = utf8ToBytes("secret")

  const envelope = yield* seal("xchacha20-poly1305", key, data)

  // Wrong key → DecryptionFailed
  const result = yield* unseal(wrongKey, envelope).pipe(
    Effect.catchTag("DecryptionFailed", (e) => Effect.succeed(`decryption failed: ${e.reason}`))
  )

  // Wrong key length → InvalidKey
  const bad = yield* seal("xchacha20-poly1305", new Uint8Array(16), data).pipe(
    Effect.catchTag("InvalidKey", (e) => Effect.succeed(`expected ${e.expected} bytes, got ${e.received}`))
  )
})
```

See the [`examples/`](./examples) directory for complete runnable programs.

## Cryptographic foundations

All primitives wrap the [Noble](https://paulmillr.com/noble/) cryptographic ecosystem — independently audited by Cure53 and Trail of Bits, zero-dependency, high-performance pure JavaScript implementations.

| Dependency       | Audits   | Purpose                               |
| ---------------- | -------- | ------------------------------------- |
| `@noble/ciphers` | 2 audits | XChaCha20-Poly1305, AES-256-GCM(-SIV) |

### Standards

| Algorithm         | Specification                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| ChaCha20-Poly1305 | [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439)                                             |
| XChaCha20         | [draft-irtf-cfrg-xchacha-03](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03) |
| AES-GCM-SIV       | [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452)                                             |
| AES-GCM           | [NIST SP 800-38D](https://doi.org/10.6028/NIST.SP.800-38D)                                     |

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
