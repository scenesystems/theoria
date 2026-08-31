# @scenesystems/seal

`@scenesystems/seal` provides authenticated encryption for [Effect](https://effect.website). It encrypts bytes with a selected AEAD algorithm and returns a `SealedEnvelope` containing the algorithm identifier, base64url nonce, and base64url ciphertext with its authentication tag. `unseal` reads the algorithm from that envelope and authenticates before returning plaintext.

The package generates nonces for each encryption operation and uses 32-byte keys for every supported algorithm. It does not provide identity, authorization, key storage, key rotation, envelope versioning, or protocol policy.

## Installation

```sh
npm install @scenesystems/seal effect
```

Effect `^3.22.1` is supported and required as a peer dependency. The package has one public entrypoint, `@scenesystems/seal`.

## Basic use

```ts typecheck
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey()
  const envelope = yield* seal("xchacha20-poly1305", key, utf8ToBytes("private data"))
  const plaintext = yield* unseal(key, envelope)
  return utf8FromBytes(plaintext)
})
```

Store and transport the complete envelope. The algorithm field is part of decryption dispatch and must be protected by the surrounding storage or protocol against unintended substitution.

## Algorithm selection

| Algorithm            |    Nonce | Selection boundary                                                                              |
| -------------------- | -------: | ----------------------------------------------------------------------------------------------- |
| `xchacha20-poly1305` | 24 bytes | Default for randomly generated nonces and application-level encryption                          |
| `aes-256-gcm-siv`    | 12 bytes | Limits the damage from accidental nonce reuse; repeated nonce and plaintext can reveal equality |
| `aes-256-gcm`        | 12 bytes | Compatibility with AES-GCM systems; nonce reuse under one key is catastrophic                   |

AES-256-GCM has a documented limit of 2^32 invocations per key in this package's profile. Key lifecycle enforcement belongs to the caller. AES-256-GCM-SIV remains subject to usage bounds even though its misuse resistance avoids GCM's catastrophic nonce-reuse failure.

## Public surface

| Area                   | Exports                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Envelope pipeline      | `seal`, `unseal`                                                                      |
| Direct AEAD operations | `xchacha20Encrypt`/`Decrypt`, `aesgcmsivEncrypt`/`Decrypt`, `aesgcmEncrypt`/`Decrypt` |
| Envelope encoding      | `packEnvelope`, `unpackEnvelope`                                                      |
| Keys and bytes         | `generateKey`, `utf8ToBytes`, `utf8FromBytes`, `equalBytes`                           |
| Schemas                | `SealAlgorithm`, `SealedEnvelope`, `InvalidKey`, `DecryptionFailed`                   |

Direct encryptors return nonce-prefixed ciphertext bytes. `packEnvelope` separates that representation into base64url fields, while `unpackEnvelope` reconstructs it. `SealedEnvelope` is a Schema class suitable for validation and serialization. Runnable programs demonstrate [encryption and decryption](./examples/01-encrypt-decrypt.ts) and [algorithm selection with typed errors](./examples/02-algorithm-comparison.ts).

## Errors and security boundaries

`InvalidKey` reports the expected and received key lengths before cryptographic processing. `DecryptionFailed` covers a wrong key, modified or truncated ciphertext, corrupted nonce, invalid envelope encoding, and authentication failure. Applications should treat these causes uniformly to avoid creating a decryption oracle.

Authenticated encryption protects confidentiality and integrity under the supplied key. It does not authenticate a person or assign meaning to an envelope. Keys must come from secure storage, remain separate from ciphertext, and be rotated according to an application-owned policy. Never reuse a key across protocols without explicit domain and lifecycle analysis.

`generateKey` obtains bytes from the platform CSPRNG. Availability and security therefore depend on a correctly configured runtime. `equalBytes` is intended for byte comparisons, though protocol-level timing behavior also includes surrounding control flow and I/O.

## Standards and implementation basis

The algorithms follow [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) and the [XChaCha20 draft](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03), [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452), and [NIST SP 800-38D](https://doi.org/10.6028/NIST.SP.800-38D). Primitive implementations come from [Noble Ciphers](https://paulmillr.com/noble/), whose audit coverage does not replace review of key handling, envelope semantics, and protocol integration.

## Status

This package is pre-1.0. Minor releases may change public APIs while contracts are refined. Review the [changelog](./CHANGELOG.md) before upgrading.

## Contribution and support

See the repository [contribution guide](../../CONTRIBUTING.md) for development and review requirements. Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for questions and bug reports. Report security-sensitive concerns through the [security policy](../../SECURITY.md).

## License

[MIT](./LICENSE) - Copyright 2026 Scene Systems
