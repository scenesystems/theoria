# @scenesystems/digest

`@scenesystems/digest` provides strict JSON canonicalization and cryptographic hashing for [Effect](https://effect.website). It supports deterministic content identifiers, raw byte and UTF-8 hashing, incremental streams, HMAC, and HKDF. Cryptographic primitives come from [Noble Hashes](https://paulmillr.com/noble/).

The content digest model is a fixed pipeline:

```text
admitted value -> RFC 8785 JCS -> strict UTF-8 -> BLAKE3-256 or SHA-256 -> base64url -> algorithm tag
```

A digest identifies the exact canonical bytes produced by this pipeline. The package does not establish identity, authenticity, authorization, key storage, rotation, application versioning, or protocol policy.

## Installation

```sh
npm install @scenesystems/digest effect
```

Effect `^3.22.1` is supported and required as a peer dependency. The package has one public entrypoint, `@scenesystems/digest`.

## Basic use

```ts typecheck
import { digest, digestSchemaValue } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const Event = Schema.Struct({
  name: Schema.String,
  occurredAt: Schema.DateFromString
})

const program = Effect.gen(function* () {
  const contentId = yield* digest("blake3-256", { score: 42, user: "alice" })
  const eventId = yield* digestSchemaValue(Event, {
    name: "deploy",
    occurredAt: new Date("2026-07-22T00:00:00.000Z")
  })
  return { contentId, eventId }
})
```

`digest` and `digestSchemaValue` return `<algorithm>:<base64url>`. A 256-bit digest has 43 unpadded base64url characters after the tag.

## Canonicalization contract

`canonicalize` and `canonicalJsonBytes` accept `null`, booleans, finite ECMAScript numbers, well-formed Unicode strings, dense arrays of accepted values, and plain records with `Object.prototype` or a null prototype. Record properties must be own, enumerable, string-keyed data properties containing accepted values.

Unsupported inputs include `undefined`, non-finite numbers, `bigint`, functions, symbols, sparse or augmented arrays, typed arrays, dates, regular expressions, maps, sets, weak collections, promises, accessors, symbol or non-enumerable record properties, unsupported prototypes, cycles, and values whose reflection operations fail. Getters are never evaluated. Hostile proxy traps can still prevent progress, so parse hostile bytes into owner-bounded plain data before canonicalization.

RFC 8785 key ordering uses UTF-16 code units. String values and keys must contain well-formed Unicode. Valid text is preserved without Unicode normalization, malformed surrogate sequences are rejected, and an explicit U+FFFD remains unchanged. The input graph must remain quiescent during Effect execution; concurrent mutation has no atomic snapshot guarantee.

`digestSchemaValue` applies `Schema.encode` before canonicalization and preserves schema environment requirements. Its failures distinguish `ParseResult.ParseError` from `CanonicalizationError`.

For untrusted sizes, `digestSchemaValueWithByteLimit` limits canonical UTF-8 emission and returns the tagged digest with the exact `canonicalByteLength`. Structural schema encoding and canonical traversal are stack-safe and cooperative, while native key enumeration and user-defined transformations remain indivisible host operations. The inclusive limit must be a non-negative safe integer. This limit does not bound descriptor admission, traversal, or key sorting, so callers still need owner-side structural bounds. `digestSchemaValueWithByteLimitSync` has the same data contract and returns `Either`; it blocks the JavaScript turn and is intended only for small owner-controlled values when an Effect runtime cannot be acquired.

## Public surface

| Area              | Main exports                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Canonical content | `canonicalize`, `canonicalJsonBytes`, `digest`, `durableFingerprint`                        |
| Schema values     | `digestSchemaValue`, `digestSchemaValueWithByteLimit`, `digestSchemaValueWithByteLimitSync` |
| Bytes and text    | `digestBytes`, `digestUtf8`, base64url and hex variants, `blake3Hash`, `sha256`             |
| Streams           | `digestByteStream`, `digestUtf8Stream`, base64url and hex variants                          |
| Authentication    | `blake3Mac`, `hmacSha256`, `hmacSha1` and encoded variants                                  |
| Key derivation    | `blake3DeriveKey`, `hkdfSha256`, `hkdfSha512`                                               |
| Encoding          | `encodeUtf8`, `toBase64Url`, `fromBase64Url`, `toHex`, `fromHex`                            |
| Schemas           | `DigestAlgorithm`, `Digest256`, `ContentDigest`, error schemas                              |

Supported digest algorithms are `blake3-256` and `sha256`. Text APIs use strict Unicode validation. Byte APIs accept arbitrary bytes. Text streams preserve valid surrogate pairs split across chunks and report malformed text at a partition-independent absolute UTF-16 index. Stream operations preserve upstream error and environment types.

Secret text requires explicit UTF-8 or wire decoding before MAC and KDF use. HMAC-SHA1 is present for protocols that require it. Protocol-specific comparison, domain separation, salt selection, and output-length policy remain caller responsibilities. Runnable programs cover [content hashing](./examples/01-content-hashing.ts), [HMAC verification](./examples/02-webhook-verification.ts), [content addressing](./examples/03-content-addressing.ts), and [streaming digests](./examples/04-streaming-digest.ts).

## Errors and security boundaries

`CanonicalizationError` is the closed union `InvalidUnicode | UnsupportedValue | CyclicValue`. Diagnostics are bounded and contain no rejected text, keys, paths, canonical preimages, or digest material. `CanonicalByteLimitError` classifies an invalid limit or an exceeded limit without exposing partial digest state. Encoding decoders return `Either` with Effect decode errors, and BLAKE3 keyed mode reports `InvalidKeyLength` unless the key is exactly 32 bytes.

Hashing does not authenticate content. Use a MAC or signature under a protocol that binds the algorithm, key, message domain, and comparison rules. Resource limits must be applied before admitting structurally unbounded input.

## Standards and conformance

The test suite uses checked-in independent vectors for [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785), the [BLAKE3 specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf), [FIPS 180-4 SHA-256](https://doi.org/10.6028/NIST.FIPS.180-4), [RFC 2104 HMAC](https://www.rfc-editor.org/rfc/rfc2104), and [RFC 5869 HKDF](https://www.rfc-editor.org/rfc/rfc5869). Additional HMAC and HKDF evidence uses RFC 4231, RFC 2202, and Project Wycheproof vectors. Fixture manifests record upstream revisions, licenses, transformations, exclusions, and local hashes.

Noble audit coverage applies to its primitive implementations. It does not replace review of this package's admission rules, selected options, error mapping, or the surrounding protocol.

## Status

This package is pre-1.0. Minor releases may change public APIs while contracts are refined. Review the [changelog](./CHANGELOG.md) before upgrading.

## Contribution and support

See the repository [contribution guide](../../CONTRIBUTING.md) for development and review requirements. Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for questions and bug reports. Report security-sensitive concerns through the [security policy](../../SECURITY.md).

## License

[MIT](./LICENSE) - Copyright 2026 Scene Systems
