# @scenesystems/seal

Authenticated encryption for Effect v4, backed by Noble Ciphers. Effect `^4.0.0` is a required peer dependency.

`Cipher` provides an injectable encryption backend and the byte-valued `Cipher.Encrypted` model. `Envelope` encodes encrypted values for base64url transport. Applications manage identity, authorization, and key lifecycle, and select the encryption algorithm.

## Installation

```sh
bun add @scenesystems/seal effect
```

Import `Cipher` and `Envelope` from the package root or their matching public subpaths, such as `@scenesystems/seal/Cipher`.

## Encrypt and decrypt

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

`Cipher.Encrypted` has `algorithm`, `nonce`, and `ciphertext` fields. The byte-valued ciphertext includes its authentication tag. Construction validates shape, not lengths or authenticity, and borrows supplied byte buffers rather than copying them. Effect's structural equality is not a constant-time secret comparison.

`Cipher.encrypt` returns fresh nonce and ciphertext buffers; `Cipher.decrypt` returns fresh plaintext. Neither mutates its inputs. Keep caller-owned bytes unchanged until an operation completes. Decryption checks exact nonce length and minimum tag length before authenticating, and does not acquire entropy.

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

`Envelope.encrypt` combines encryption and encoding; `Envelope.decrypt` combines decoding and authentication, also supporting pipeable `Envelope.decrypt(key)`. Both preserve the `Cipher.Cipher` requirement. Unknown input should go through schema admission, whose schema errors are distinct from Cipher's sanitized failures; do not expose input-bearing schema diagnostics to an untrusted peer.

The algorithm field is metadata, **not authenticated AAD**. Enforce the protocol's chosen algorithm before decryption. There is no AAD or caller-supplied nonce API.

## Algorithms and key lifecycle

| Algorithm            |    Nonce | Contract                                                  |
| -------------------- | -------: | --------------------------------------------------------- |
| `xchacha20-poly1305` | 24 bytes | Recommended for randomly generated nonces.                |
| `aes-256-gcm-siv`    | 12 bytes | Resists accidental nonce reuse; usage limits still apply. |
| `aes-256-gcm`        | 12 bytes | Nonce reuse under one key is catastrophic.                |

All algorithms use 32-byte keys and 16-byte tags. All-zero keys are rejected as Theoria policy, not an AEAD standard requirement. `Cipher.generateKey` produces a fresh key on every execution. `Cipher.layer` uses the host CSPRNG through Noble, never Effect's seedable Random service; provide it at the host boundary. Layer construction does not acquire entropy.

For 96-bit random nonces, keep message counts per AES key well below 2^32. Noble recommends around 2^23 messages for a collision probability near 2^-50. Choose stricter limits when required and rotate keys on an application-owned schedule. Do not reuse keys across protocols without a domain and lifecycle analysis.

## Typed failures

- `Cipher.InvalidKey`: wrong length or all-zero key; carries only expected/received lengths and a fixed reason.
- `Cipher.DecryptionFailed`: malformed transport encoding uses `invalid envelope encoding`; wrong keys, wrong field lengths, and modified ciphertext use `authentication failed`.
- `Cipher.EncryptionFailed`: encryption or secure nonce acquisition failed; carries only the algorithm.
- `Cipher.KeyGenerationFailed`: secure key generation failed.

These use `Data.TaggedError` and retain no key/plaintext material or primitive causes. Use `Effect.catchTag`; protocols own outward error representations. Treat authentication failures uniformly.

## Verification and examples

Independent Wycheproof and RFC 8452 known answers cover all algorithms. Tests cover seeded byte-preservation properties, JSON codecs, independent buffer ownership, invalid fields, key boundaries, entropy failure, lazy acquisition, and interruption/finalization. Noble's audits cover the primitives, not application protocol policy.

See [examples](./examples/), [tests](./test/), [contributing](../../CONTRIBUTING.md), and [security](../../SECURITY.md).

This package is pre-1.0; minor releases may change APIs. See the [changelog](./CHANGELOG.md) when upgrading.

[MIT](./LICENSE). Copyright 2026 Scene Systems.
