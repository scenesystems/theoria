# @scenesystems/seal

Authenticated encryption for [Effect](https://effect.website), backed by [Noble Ciphers](https://paulmillr.com/noble/). Encrypt bytes with a fresh cryptographic nonce; decrypt them with authentication and typed failures.

`Cipher` owns algorithms, key policy, failures, and the injectable encryption backend. Its operations exchange nonce-prefixed ciphertext bytes. `Envelope` owns the JSON-compatible representation and composes that backend for storage and transport. Identity, authorization, key storage, rotation, versioning, and algorithm policy belong to the application. Use [`@scenesystems/sign`](../sign/README.md) for signatures or key agreement and [`@scenesystems/digest`](../digest/README.md) for key derivation.

## Installation and imports

```sh
bun add @scenesystems/seal effect
```

Effect `^3.22.1` is a required peer dependency. Root namespaces and public subpaths expose the same canonical declarations:

```ts typecheck
import { Cipher, Envelope } from "@scenesystems/seal"
// Alternatively:
// import * as Cipher from "@scenesystems/seal/Cipher"
// import * as Envelope from "@scenesystems/seal/Envelope"

export const algorithm: Cipher.Algorithm = "xchacha20-poly1305"
export const envelopeSchema = Envelope.Envelope
```

Only `.`, `/Cipher`, and `/Envelope` are supported. Private mechanics are not package entrypoints.

## Encrypt and decrypt an envelope

`Cipher.generateKey` produces a new 32-byte key on each execution. `Cipher.layer` supplies the Noble backend; provide it near the application entrypoint. It acquires no resources or entropy until an operation executes. Keys and nonces come from the host's `crypto.getRandomValues`, never Effect's seedable `Random` service.

```ts typecheck
import { Cipher, Envelope } from "@scenesystems/seal"
import { Effect } from "effect"

export const program = Effect.gen(function* () {
  const key = yield* Cipher.generateKey
  const plaintext = Uint8Array.of(0, 1, 2, 127, 128, 255)
  const envelope = yield* Envelope.encrypt("xchacha20-poly1305", key, plaintext)
  return yield* Envelope.decrypt(key, envelope)
}).pipe(Effect.provide(Cipher.layer))
```

All encryption and decryption operations require `Cipher.Cipher`. The backend validates keys before primitive execution and returns newly allocated output without mutating input. Keep caller-owned byte arrays unchanged until an operation finishes. Keys must be exactly 32 bytes and not all zero; the all-zero restriction is Theoria policy, not a requirement of the underlying AEAD standards. There is no AAD or caller-supplied nonce API.

## Decode external input; construct typed values

`Envelope.Envelope` is a `Schema.Class`. Use `new Envelope.Envelope(...)` or `Envelope.Envelope.make(...)` with typed fields; construction validates and can throw. Admit untrusted data with `Schema.decodeUnknown`, which exposes `ParseError` in the failure channel.

Encoded JSON and constructor input both contain `algorithm`, `nonce`, and `ciphertext` strings. The decoded value is a class instance with Effect equality and hashing. The schema checks the algorithm and field types, **not** base64url syntax, lengths, or authenticity. `Envelope.toBytes` checks encoding and lengths. `Envelope.decrypt` additionally authenticates. A successful schema decode alone is not evidence of authenticity.

```ts typecheck
import * as Cipher from "@scenesystems/seal/Cipher"
import * as Envelope from "@scenesystems/seal/Envelope"
import { Effect, Schema } from "effect"

export const openStored = (key: Uint8Array, stored: unknown) =>
  Effect.gen(function* () {
    const envelope = yield* Schema.decodeUnknown(Envelope.Envelope)(stored)
    return yield* Envelope.decrypt(key, envelope)
  }).pipe(Effect.provide(Cipher.layer))

export const encodeJson = Schema.encode(Schema.parseJson(Envelope.Envelope))
```

Encryption emits unpadded base64url. Decoding accepts Effect Encoding's base64url syntax, including padding. The ciphertext field includes its 16-byte authentication tag. Store the whole envelope. The algorithm identifier drives dispatch but is not authenticated as AAD; enforce the protocol's chosen algorithm before decryption and treat algorithm changes as versioned migrations.

## Nonce-prefixed bytes

`Cipher.encrypt(algorithm, key, plaintext)` returns `nonce ‖ ciphertext ‖ tag`; `Cipher.decrypt(algorithm, key, bytes)` consumes that layout. It contains no algorithm identifier. Use this representation when the surrounding protocol already fixes the algorithm.

`Envelope.fromBytes` is a pure partition-and-encode conversion, not an Effect. It also represents short input without authenticating it. `Envelope.toBytes` returns an `Either` and rejects invalid encoding, a nonce of the wrong size, or ciphertext shorter than a tag. It does not authenticate the ciphertext. Both conversions allocate output and retain no source buffers.

```ts typecheck
import { Cipher, Envelope } from "@scenesystems/seal"
import { Effect } from "effect"

export const encryptForWire = (key: Uint8Array, plaintext: Uint8Array) =>
  Effect.gen(function* () {
    const raw = yield* Cipher.encrypt("xchacha20-poly1305", key, plaintext)
    const envelope = Envelope.fromBytes("xchacha20-poly1305", raw)
    const bytes = yield* Envelope.toBytes(envelope)
    return { envelope, bytes }
  })
// The host provides Cipher.layer; encryptForWire preserves its Cipher requirement.
```

## Choose an algorithm and a key lifecycle

| Algorithm            |    Nonce | Contract                                                                                             |
| -------------------- | -------: | ---------------------------------------------------------------------------------------------------- |
| `xchacha20-poly1305` | 24 bytes | Recommended default. The large nonce space permits random nonces at practical message counts.        |
| `aes-256-gcm-siv`    | 12 bytes | Resists accidental nonce reuse; repeated inputs can still reveal equality. Usage bounds still apply. |
| `aes-256-gcm`        | 12 bytes | Interoperability with AES-GCM protocols. Nonce reuse under one key is catastrophic.                  |

For 96-bit random nonces, keep message counts per AES key well below 2^32. Noble recommends around 2^23 messages for a collision probability near 2^-50. Choose stricter limits when the protocol requires them, and rotate keys on an application-owned schedule. Never use seedable test randomness for production keys or nonces. Do not reuse keys across protocols without an explicit domain and lifecycle analysis.

## Failures

- `Cipher.InvalidKey`: wrong length or all-zero key; retains the published `InvalidKey` tag and `expected`, `received`, and `reason` fields.
- `Cipher.DecryptionFailed`: malformed base64url uses `invalid envelope encoding`; wrong keys, invalid lengths, and modified data use `authentication failed`. Retains the published `DecryptionFailed` tag, `algorithm`, and `reason` fields.
- `Cipher.EncryptionFailed`: the backend could not encrypt, including failure to obtain a secure nonce. Contains only the algorithm.
- `Cipher.KeyGenerationFailed`: secure key generation failed.

Use `Effect.catchTag` for expected failures. `InvalidKey` and `DecryptionFailed` retain their Schema codecs. The new backend failures use `Data.TaggedError`, since they have no wire-codec contract. Backend exceptions never expose secrets in diagnostics. Treat all authentication failures the same way at a protocol boundary to avoid creating an oracle.

## Migrating from 0.2

This is a breaking pre-1.0 minor release, without permanent aliases. Valid stored envelopes and nonce-prefixed ciphertext remain compatible.

| Previous API                                                                                | Replacement                                                                  |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `seal` / `unseal`                                                                           | `Envelope.encrypt` / `Envelope.decrypt`, with `Cipher.layer`                 |
| `xchacha20Encrypt` / `Decrypt`, `aesgcmEncrypt` / `Decrypt`, `aesgcmsivEncrypt` / `Decrypt` | `Cipher.encrypt` / `Cipher.decrypt` with the corresponding algorithm literal |
| `packEnvelope` / `unpackEnvelope`                                                           | pure `Envelope.fromBytes` / `Either`-returning `Envelope.toBytes`            |
| `SealedEnvelope`                                                                            | `Envelope.Envelope`                                                          |
| `SealAlgorithm`                                                                             | `Cipher.Algorithm` (both schema and type)                                    |
| `InvalidKey` / `DecryptionFailed`                                                           | `Cipher.InvalidKey` / `Cipher.DecryptionFailed`                              |
| `generateKey(length?)`                                                                      | `Cipher.generateKey`, always 32 bytes                                        |
| `utf8ToBytes` / `utf8FromBytes`                                                             | `TextEncoder.encode` / `TextDecoder.decode`                                  |
| `equalBytes`                                                                                | use your byte-comparison library directly; not an encryption concern         |

Encoding/length failures from `Envelope.toBytes` now use `DecryptionFailed`, not `Encoding.DecodeException`. Invalid field boundaries that previously reconstructed valid raw ciphertext are rejected. Runtime entropy failures are typed failures rather than defects. No ciphertext re-encryption is needed for valid existing envelopes.

## Evidence and examples

The [tests](./test/) check independent Wycheproof and RFC 8452 known answers for all three algorithms, seeded byte-preservation laws, malformed data, key boundaries, entropy failure, and public envelope composition. Round trips supplement rather than replace conformance vectors.

The algorithms follow [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) with the [XChaCha20 extension](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03), [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452), and [NIST SP 800-38D](https://doi.org/10.6028/NIST.SP.800-38D). Noble's audits cover the primitives, not application key management or protocol policy.

See the [Cipher](./src/Cipher.ts) and [Envelope](./src/Envelope.ts) API declarations, [encryption example](./examples/01-encrypt-decrypt.ts), and [algorithm comparison](./examples/02-algorithm-comparison.ts).

## Contributing and support

This package is pre-1.0; pin a compatible version and review the [changelog](./CHANGELOG.md). Read the [contributing guide](../../CONTRIBUTING.md), use [GitHub issues](https://github.com/scenesystems/theoria/issues) for defects, and follow the [security policy](../../SECURITY.md) for security reports.

[MIT](./LICENSE). Copyright 2026 Scene Systems.
