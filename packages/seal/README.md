# @scenesystems/seal

`@scenesystems/seal` provides authenticated encryption for programs built with [Effect](https://effect.website). Use it when bytes must stay confidential at rest or in transit and any modification must be detected on decryption: a session record in a cache, a token handed to a browser, or a payload stored by a third party.

The model is a single envelope. `seal` encrypts bytes with a chosen AEAD algorithm and returns a `SealedEnvelope` that carries the algorithm identifier, a fresh base64url nonce, and the base64url ciphertext with its authentication tag. `unseal` reads the algorithm from the envelope, authenticates, and returns plaintext or a typed error. Every algorithm uses a 32-byte key, and the package generates a new nonce for each call. Primitive implementations come from [Noble Ciphers](https://paulmillr.com/noble/).

The package encrypts and nothing more. Identity, authorization, key storage, key rotation, envelope versioning, and protocol policy belong to the application. [`@scenesystems/sign`](../sign/README.md) provides signatures and key agreement for the identity half of a protocol, and [`@scenesystems/digest`](../digest/README.md) derives keys with HKDF or BLAKE3 when a shared secret must become a sealing key.

## Installation

```sh
npm install @scenesystems/seal effect
```

Effect `^3.22.1` is a required peer dependency. The package has one entrypoint, `@scenesystems/seal`.

## Basic use

`generateKey` draws 32 bytes from the platform's cryptographically secure random source. `seal` and `unseal` round-trip bytes through an envelope; `utf8ToBytes` and `utf8FromBytes` convert text at the edges.

```ts typecheck
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

export const program = Effect.gen(function* () {
  const key = yield* generateKey()
  const envelope = yield* seal("xchacha20-poly1305", key, utf8ToBytes("private data"))
  const plaintext = yield* unseal(key, envelope)
  return utf8FromBytes(plaintext)
})
```

Store and transport the whole envelope. The `algorithm` field drives decryption dispatch, so the surrounding storage or protocol must protect it from substitution just as it protects the key.

## Algorithm selection

`SealAlgorithm` is a literal union of three AEAD constructions. All three take a 32-byte key and differ in nonce size and in how they fail when a nonce repeats under one key.

| Algorithm            |    Nonce | When to choose it                                                                                       |
| -------------------- | -------: | ------------------------------------------------------------------------------------------------------- |
| `xchacha20-poly1305` | 24 bytes | Default. The large nonce makes random generation safe for any practical number of messages per key.     |
| `aes-256-gcm-siv`    | 12 bytes | Nonce reuse leaks only whether two plaintexts are equal, rather than breaking confidentiality outright. |
| `aes-256-gcm`        | 12 bytes | Interoperability with existing AES-GCM systems. Nonce reuse under one key is catastrophic.              |

With 12-byte random nonces, keep the number of messages per AES key well below 2^32 and rotate keys on an application-owned schedule. AES-256-GCM-SIV tolerates accidental reuse but is still subject to per-key usage bounds. Choose one algorithm per protocol and treat a change of algorithm as a versioned migration rather than a per-message option.

## Envelopes and direct operations

`SealedEnvelope` is a `Schema.Class`, so it decodes from and encodes to plain JSON with Effect's `Schema` functions and validates the base64url fields on the way in.

```ts typecheck
import { SealedEnvelope, unseal } from "@scenesystems/seal"
import { Effect, Schema } from "effect"

export const openStored = (key: Uint8Array, stored: unknown) =>
  Effect.gen(function* () {
    const envelope = yield* Schema.decodeUnknown(SealedEnvelope)(stored)
    return yield* unseal(key, envelope)
  })
```

The direct functions `xchacha20Encrypt`, `aesgcmsivEncrypt`, and `aesgcmEncrypt` return nonce-prefixed ciphertext bytes instead of an envelope, and their `Decrypt` counterparts consume the same layout. Use them when a wire format already fixes the algorithm and you only need the bytes. `packEnvelope(algorithm, raw)` splits nonce-prefixed bytes into an envelope and `unpackEnvelope(envelope)` reverses it, so the two representations convert without re-encrypting.

```ts typecheck
import { packEnvelope, xchacha20Encrypt } from "@scenesystems/seal"
import { Effect } from "effect"

export const sealForWire = (key: Uint8Array, plaintext: Uint8Array) =>
  Effect.gen(function* () {
    const raw = yield* xchacha20Encrypt(key, plaintext)
    const envelope = yield* packEnvelope("xchacha20-poly1305", raw)
    return { raw, envelope }
  })
```

## Public surface

The package exports plain functions and schemas from a single entrypoint.

| Area              | Exports                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| Envelope pipeline | `seal`, `unseal`                                                                      |
| Direct AEAD       | `xchacha20Encrypt`/`Decrypt`, `aesgcmsivEncrypt`/`Decrypt`, `aesgcmEncrypt`/`Decrypt` |
| Envelope encoding | `packEnvelope`, `unpackEnvelope`                                                      |
| Keys and bytes    | `generateKey`, `utf8ToBytes`, `utf8FromBytes`, `equalBytes`                           |
| Schemas           | `SealAlgorithm`, `SealedEnvelope`, `InvalidKey`, `DecryptionFailed`                   |

The full list with signatures is in the [API reference](./src/index.ts).

## Errors and boundaries

`InvalidKey` reports the expected and received key lengths and is raised before any cryptographic work. `DecryptionFailed` carries one of two reasons: `invalid envelope encoding` for malformed base64url, and `authentication failed` for a wrong key, modified or truncated ciphertext, a corrupted nonce, or a tag mismatch. The second reason deliberately does not say which condition occurred. Treat every decryption failure the same way in application logic so that error handling does not become a decryption oracle. `unpackEnvelope` on its own fails with Effect's `Encoding.DecodeException`.

Authenticated encryption protects confidentiality and integrity under the supplied key. It does not identify who produced an envelope or say what the envelope means. Keys must come from secure storage, stay separate from ciphertext, and rotate on a policy the application owns. Do not reuse a key across protocols without an explicit domain and lifecycle analysis. `generateKey` depends on the runtime's `crypto.getRandomValues`, and `equalBytes` compares same-length arrays without early exit, though timing at the protocol level also includes the surrounding control flow and I/O.

## Standards

The algorithms follow [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) with the [XChaCha20 extension](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03), [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452), and [NIST SP 800-38D](https://doi.org/10.6028/NIST.SP.800-38D). Noble's audits cover the primitive implementations; key handling, envelope semantics, and protocol integration are reviewed separately in this package and in your application.

## Examples

The [examples directory](./examples/) contains two runnable programs: [encryption and decryption](./examples/01-encrypt-decrypt.ts) through an envelope, and [algorithm comparison](./examples/02-algorithm-comparison.ts), which seals one message under each algorithm and handles `DecryptionFailed` and `InvalidKey` with `Effect.catchTag`.

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
