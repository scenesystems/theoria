# @scenesystems/digest

`@scenesystems/digest` computes content identifiers, hashes, message authentication codes, and derived keys for programs built with [Effect](https://effect.website). Use it when two processes must agree on the identity of a JSON value, when a cache or store is keyed by content, when a webhook body must be authenticated, or when key material must be derived from a shared secret.

The content digest model is a fixed pipeline: an admitted plain-data value is canonicalized with RFC 8785 JSON Canonicalization Scheme, encoded as strict UTF-8, hashed with BLAKE3-256 or SHA-256, and rendered as `<algorithm>:<base64url>`. A digest therefore identifies exactly one byte sequence, and any two producers that follow the same pipeline agree on it. The primitives come from [Noble Hashes](https://paulmillr.com/noble/), which are audited, dependency-free, and run in every JavaScript runtime.

[`@scenesystems/effect-search`](../effect-search/README.md) and [`@scenesystems/effect-math`](../effect-math/README.md) use this package for cache keys and artifact identities. [`@scenesystems/seal`](../seal/README.md) and [`@scenesystems/sign`](../sign/README.md) provide encryption and signatures, which hashing alone does not.

## Installation

```sh
npm install @scenesystems/digest effect
```

Effect `^3.22.1` is a required peer dependency. The package has one entrypoint, `@scenesystems/digest`.

## Basic use

`digest` canonicalizes a plain value and returns its tagged digest. `digestSchemaValue` encodes a value through an Effect `Schema` first, so the digest reflects the wire representation rather than the in-memory one.

```ts typecheck
import { digest, digestSchemaValue } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const Event = Schema.Struct({
  name: Schema.String,
  occurredAt: Schema.DateFromString
})

export const program = Effect.gen(function* () {
  const contentId = yield* digest("blake3-256", { score: 42, user: "alice" })
  const eventId = yield* digestSchemaValue(Event, {
    name: "deploy",
    occurredAt: new Date("2026-07-22T00:00:00.000Z")
  })
  return { contentId, eventId }
})
```

Both return `<algorithm>:<base64url>`; a 256-bit digest has 43 unpadded base64url characters after the tag. Key order in the input does not matter, because canonicalization sorts keys. Failures surface in the error channel as `CanonicalizationError` and, for schema values, `ParseResult.ParseError`.

## Content digests

`digest(algorithm, value)` is the general entry point, with `blake3-256` and `sha256` as the supported algorithms. `durableFingerprint(value)` is the same pipeline fixed to BLAKE3-256, intended for identifiers that are stored and compared across releases. `canonicalize(value)` returns the canonical JSON string and `canonicalJsonBytes(value)` its UTF-8 bytes, for callers that need the preimage itself.

`digestSchemaValue(schema, value, algorithm?)` applies `Schema.encode` and keeps any service requirements the schema declares. When the value comes from an untrusted source and could be large, use `digestSchemaValueWithByteLimit(schema, value, maximumBytes, algorithm?)`. It stops emitting canonical bytes at the inclusive limit, fails with `CanonicalByteLimitExceeded`, and on success returns the digest with the exact `canonicalByteLength`. `digestSchemaValueWithByteLimitSync` has the same contract and returns an `Either` for small, owner-controlled values in code that cannot run an Effect.

```ts typecheck
import { digestSchemaValueWithByteLimit } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const Payload = Schema.Struct({ id: Schema.String, tags: Schema.Array(Schema.String) })

export const identify = (payload: typeof Payload.Type) =>
  digestSchemaValueWithByteLimit(Payload, payload, 64 * 1024).pipe(
    Effect.map((result) => ({ id: result.digest, bytes: result.canonicalByteLength })),
    Effect.catchTag("CanonicalByteLimitExceeded", () => Effect.succeed({ id: "too-large", bytes: -1 }))
  )
```

The byte limit bounds output, not traversal. Structurally unbounded input, such as deeply nested or extremely wide objects, must be limited by the caller before it reaches canonicalization.

## Canonicalization contract

`canonicalize` accepts `null`, booleans, finite numbers, well-formed Unicode strings, dense arrays of accepted values, and plain records whose prototype is `Object.prototype` or `null`. Record properties must be own, enumerable, string-keyed data properties. Everything else is rejected with `UnsupportedValue`: `undefined`, `NaN` and infinities, `bigint`, functions, symbols, sparse arrays, typed arrays, dates, regular expressions, maps, sets, promises, accessors, and class instances. Cycles are reported as `CyclicValue`. Getters are never evaluated.

Strings must be well-formed UTF-16. A lone surrogate is reported as `InvalidUnicode` with its index; valid text is preserved byte for byte without Unicode normalization. Keys sort by UTF-16 code unit as RFC 8785 requires. The input must not be mutated while canonicalization runs.

The contract is deliberately narrow so that a digest computed in one runtime, language, or release matches a digest computed in another. Convert domain objects to plain data with a `Schema` before digesting them; that is what `digestSchemaValue` does for you.

## Bytes, streams, and authentication

For data that is already bytes or text, skip canonicalization. `digestBytes(algorithm, bytes)` and `digestUtf8(algorithm, text)` return raw digest bytes; the `Base64Url` and `Hex` suffixed variants return encoded strings. `blake3Hash` and `sha256` are the underlying one-shot functions.

`digestByteStream(algorithm, stream)` and `digestUtf8Stream(algorithm, stream)` hash an Effect `Stream` incrementally without buffering it, preserving the stream's error and requirement types. The text variant handles surrogate pairs split across chunks and reports malformed text at its absolute index.

Hashing does not authenticate. To prove that a message came from a holder of a shared key, use `hmacSha256(key, message)`, `hmacSha1` where a protocol requires it, or `blake3Mac(key, message)`, which needs exactly a 32-byte key. `hkdfSha256(ikm, salt, info, length)`, `hkdfSha512`, and `blake3DeriveKey(context, input, length)` derive keys from shared material.

```ts typecheck
import { encodeUtf8, hmacSha256, hmacSha256Base64Url, toBase64Url } from "@scenesystems/digest"
import { Effect } from "effect"

export const signWebhook = (secret: string, body: string) =>
  Effect.gen(function* () {
    const key = yield* encodeUtf8(secret)
    const payload = yield* encodeUtf8(body)
    return yield* hmacSha256Base64Url(key, payload)
  })

export const authenticatorBytes = (key: Uint8Array, payload: Uint8Array) =>
  Effect.map(hmacSha256(key, payload), (mac) => ({ mac, encoded: toBase64Url(mac) }))
```

Compare a received authenticator with a recomputed one using a constant-time comparison, and bind the algorithm, key identity, and message domain in the surrounding protocol. Secret text must be encoded to bytes with `encodeUtf8` or decoded from its wire encoding with `fromBase64Url` or `fromHex` before it is used as a key.

## Public surface

The package exports plain functions and schemas from a single entrypoint.

| Area            | Exports                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| Content digests | `digest`, `durableFingerprint`, `canonicalize`, `canonicalJsonBytes`                        |
| Schema values   | `digestSchemaValue`, `digestSchemaValueWithByteLimit`, `digestSchemaValueWithByteLimitSync` |
| Bytes and text  | `digestBytes`, `digestUtf8`, their `Base64Url` and `Hex` variants, `blake3Hash`, `sha256`   |
| Streams         | `digestByteStream`, `digestUtf8Stream`, their `Base64Url` and `Hex` variants                |
| Authentication  | `hmacSha256`, `hmacSha1`, `blake3Mac`, and their encoded variants                           |
| Key derivation  | `hkdfSha256`, `hkdfSha512`, `blake3DeriveKey`                                               |
| Encoding        | `encodeUtf8`, `toBase64Url`, `fromBase64Url`, `toHex`, `fromHex`                            |
| Schemas         | `DigestAlgorithm`, `Digest256`, `ContentDigest`, and the error classes                      |

The full list with signatures is in the [API reference](./src/index.ts).

## Errors and boundaries

`CanonicalizationError` is the closed union `InvalidUnicode | UnsupportedValue | CyclicValue`. `CanonicalByteLimitError` is `CanonicalByteLimitExceeded | InvalidCanonicalByteLimit`. `blake3Mac` fails with `InvalidKeyLength` for any key that is not 32 bytes. The decoders `fromBase64Url` and `fromHex` return `Either` with Effect's decode error. All error values carry bounded diagnostics and never include rejected text, keys, paths, canonical preimages, or digest material.

The package establishes content identity and nothing more. Authenticity requires a MAC or signature, confidentiality requires encryption, and key storage, rotation, versioning, and comparison rules belong to the protocol around it.

## Standards

The test suite checks against published vectors for [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785), the [BLAKE3 specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf), [FIPS 180-4 SHA-256](https://doi.org/10.6028/NIST.FIPS.180-4), [RFC 2104 HMAC](https://www.rfc-editor.org/rfc/rfc2104), and [RFC 5869 HKDF](https://www.rfc-editor.org/rfc/rfc5869), with additional HMAC and HKDF vectors from RFC 4231, RFC 2202, and Project Wycheproof. Noble's audits cover the primitive implementations; the admission rules, option selection, and error mapping in this package are reviewed separately.

## Examples

The [examples directory](./examples/) contains one runnable program per capability: [content hashing](./examples/01-content-hashing.ts), [webhook verification with HMAC](./examples/02-webhook-verification.ts), [content addressing](./examples/03-content-addressing.ts), and [streaming digests](./examples/04-streaming-digest.ts).

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
