# @scenesystems/seal

Seal provides authenticated encryption for [Effect](https://effect.website) using Noble Ciphers. Encrypt bytes through `Cipher`, then use `Envelope` to encode the result for transport. Your application chooses the algorithm and manages keys, including who may use them.

## Installation

```sh
bun add @scenesystems/seal effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/seal/Cipher`.

## Basic use

Encrypt bytes with XChaCha20-Poly1305, encode the result as JSON, and decrypt the decoded value.

```ts typecheck
import { Cipher, Envelope } from "@scenesystems/seal"
import { Effect, Schema } from "effect"

export const program = Effect.gen(function* () {
  const key = yield* Cipher.generateKey
  const plaintext = yield* Schema.decodeEffect(Schema.Uint8ArrayFromHex)("0001027f80ff")
  const encrypted = yield* Cipher.encrypt("xchacha20-poly1305", key, plaintext)
  const codec = Schema.fromJsonString(Envelope.Envelope)
  const json = yield* Schema.encodeEffect(codec)(encrypted)
  const decoded = yield* Schema.decodeEffect(codec)(json)
  return yield* Cipher.decrypt(decoded, key)
}).pipe(Effect.provide(Cipher.layer))
```

`Cipher.Encrypted` contains the algorithm, nonce, and ciphertext, including the authentication tag. Constructing this model checks its shape and borrows its byte buffers; decryption checks lengths and authenticity. Keep input bytes unchanged until an operation completes.

Encryption and decryption leave their inputs untouched and return fresh output buffers. Only encryption needs entropy. Use a constant-time comparison for secrets; Effect's structural equality does not provide one.

## Encode for transport

`Envelope.Envelope` decodes to `Cipher.Encrypted`; its encoded value (`Envelope.Encoded`) contains the same field names with base64url strings. Encoding emits unpadded base64url. Decoding validates encoding and allocates fresh byte fields, but does not authenticate or enforce algorithm-specific lengths.

Count cryptographic payload bytes as nonce length plus ciphertext length, not JSON length.

```ts typecheck
import { Cipher, Envelope } from "@scenesystems/seal"
import { Effect, Schema } from "effect"

export const openStored = (key: Uint8Array, stored: unknown) =>
  Schema.decodeUnknownEffect(Envelope.Envelope)(stored).pipe(
    Effect.flatMap((encrypted) => Cipher.decrypt(encrypted, key))
  )

export const sealForTransport = (key: Uint8Array, plaintext: Uint8Array) =>
  Envelope.encrypt("xchacha20-poly1305", key, plaintext)

export const openTyped = (key: Uint8Array, stored: Envelope.Encoded) => Envelope.decrypt(stored, key)
```

`Envelope.encrypt` encrypts and encodes in one operation. `Envelope.decrypt`
decodes and authenticates, and also supports pipeable `Envelope.decrypt(key)`.
Both require `Cipher.Cipher`. For unknown input, use Schema decoding as in
`openStored` above. Schema errors can contain input data, so keep those
diagnostics private even though Cipher's own failures are sanitized.

The algorithm field is metadata, **not authenticated AAD**. Enforce the protocol's chosen algorithm before decryption. There is no AAD or caller-supplied nonce API.

## Algorithms and key lifecycle

| Algorithm            |    Nonce | Contract                                                  |
| -------------------- | -------: | --------------------------------------------------------- |
| `xchacha20-poly1305` | 24 bytes | Recommended for randomly generated nonces.                |
| `aes-256-gcm-siv`    | 12 bytes | Resists accidental nonce reuse; usage limits still apply. |
| `aes-256-gcm`        | 12 bytes | Nonce reuse under one key is catastrophic.                |

All algorithms use 32-byte keys and 16-byte tags. All-zero keys are rejected as Theoria policy, not an AEAD standard requirement. `Cipher.generateKey` produces a fresh key on every execution. `Cipher.layer` uses the host CSPRNG through Noble, never Effect's seedable Random service; provide it at the host boundary. Layer construction does not acquire entropy.

For 96-bit random nonces, keep message counts per AES key well below 2^32. Noble recommends around 2^23 messages for a collision probability near 2^-50. Choose stricter limits when required and rotate keys on an application-owned schedule. Do not reuse keys across protocols without a domain and lifecycle analysis.

## Errors

- `Cipher.InvalidKey`: wrong length or all-zero key; carries only expected/received lengths and a fixed reason.
- `Cipher.DecryptionFailed`: malformed transport encoding uses `invalid envelope encoding`; wrong keys, wrong field lengths, and modified ciphertext use `authentication failed`.
- `Cipher.EncryptionFailed`: encryption or secure nonce acquisition failed; carries only the algorithm.
- `Cipher.KeyGenerationFailed`: secure key generation failed.

These use `Data.TaggedError` and retain no key/plaintext material or primitive causes. Use `Effect.catchTag`; protocols own outward error representations. Treat authentication failures uniformly.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Encryption and decryption](./examples/01-encrypt-decrypt.ts)
- [Algorithm comparison](./examples/02-algorithm-comparison.ts)

## Verification

Tests compare every algorithm with independent Wycheproof or RFC 8452 known
answers and check round trips, buffer ownership, and failure handling. Noble's
audits cover the underlying primitives; applications still need protocol review.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
