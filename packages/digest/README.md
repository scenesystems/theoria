# @scenesystems/digest

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Strict canonicalization and cryptographic digest primitives for [Effect](https://effect.website), built on [Noble Hashes](https://paulmillr.com/noble/).

## Install

```sh
bun add @scenesystems/digest effect
```

`effect` is a required peer dependency (`^3.22.1`). The package has one public entrypoint: `@scenesystems/digest`.

## Content identity

The content-addressing pipeline is:

```text
admitted value → RFC 8785 JCS → strict UTF-8 → BLAKE3-256 or SHA-256 → base64url → algorithm tag
```

```ts typecheck
import {
  canonicalJsonBytes,
  digest,
  digestSchemaValue,
  digestSchemaValueWithByteLimit,
  digestSchemaValueWithByteLimitSync
} from "@scenesystems/digest"
import { Effect, Either, Schema } from "effect"

const Event = Schema.Struct({
  name: Schema.String,
  occurredAt: Schema.DateFromString
})

const program = Effect.gen(function* () {
  const canonicalBytes = yield* canonicalJsonBytes({ score: 42, user: "alice" })
  const tagged = yield* digest("blake3-256", { score: 42, user: "alice" })
  const schemaTagged = yield* digestSchemaValue(Event, {
    name: "deploy",
    occurredAt: new Date("2026-07-22T00:00:00.000Z")
  })
  const boundedSchemaDigest = yield* digestSchemaValueWithByteLimit(
    Event,
    {
      name: "deploy",
      occurredAt: new Date("2026-07-22T00:00:00.000Z")
    },
    1_024
  )

  return { boundedSchemaDigest, canonicalBytes, tagged, schemaTagged }
})

const synchronous = digestSchemaValueWithByteLimitSync(
  Event,
  {
    name: "startup",
    occurredAt: new Date("2026-07-22T00:00:00.000Z")
  },
  1_024
)

if (Either.isLeft(synchronous)) {
  // Handle ParseError, CanonicalizationError, or CanonicalByteLimitError.
}
```

`digest` and `digestSchemaValue` return `"<algorithm>:<base64url>"`. A 256-bit digest uses 43 unpadded base64url characters. Both byte-limited Schema APIs return that tagged text as `digest` together with its exact `canonicalByteLength`.

Digest identifies exact bytes. It does not define application domains, versions, normalization policy, ownership, or authenticity.

## Strict canonicalization contract

`canonicalize` and `canonicalJsonBytes` admit only:

- `null`, booleans, finite ECMAScript numbers, and well-formed Unicode strings;
- dense arrays containing admitted values; and
- plain records whose prototype is `Object.prototype` or `null`, containing only own enumerable string-keyed data properties whose values are admitted.

They reject `undefined`, non-finite numbers, `bigint`, functions, symbols, sparse or augmented arrays, typed arrays, `Date`, `RegExp`, maps, sets, weak collections, promises, accessors, symbol or non-enumerable properties, unsupported prototypes, cyclic graphs, and reflection failures.

Object keys and string values are validated before serialization. Every public text path rejects unpaired UTF-16 surrogates, preserves valid text without Unicode normalization, and never inserts U+FFFD as replacement text. An explicit U+FFFD in admitted input is preserved. `canonicalize` sorts record keys by UTF-16 code units as required by RFC 8785.

Canonicalization uses an explicit stack-safe state machine and has no call-stack growth with input depth. For an admitted graph its cost is linear in visited nodes and emitted output plus key sorting for each record. One-shot canonicalization and digest operations process at most 512 traversal units per batch and yield to the Effect scheduler only when traversal work remains. They admit Bun and Node host timers every 32 continuing traversal batches (at most 16,384 units). Canonical-byte encoding and copying process at most four approximately 32 KiB text segments per batch, yield only between continuing assembly batches, and admit host timers every eight continuing assembly batches. Terminal traversal, encoding, and copying batches return directly without a no-progress yield. Only the intrinsically one-shot allocation of the final `Uint8Array` is outside those assembly batches.

The 0.3.0 documentation's no-yield sentence described defective implementation behavior corrected by 0.3.1, not a durable semantic guarantee. Version 0.3.1 changes responsiveness only: canonical bytes, the admitted domain, errors and their precedence, and public APIs remain unchanged. A host turn after every 512-unit batch was measured and rejected because Bun's approximately 1 ms timer floor raised the 65,536-point workload from under one second to roughly six seconds without improving the already-sub-250 ms delay envelope; the documented cadence preserves fiber interruption at every batch while amortizing host turns.

Version 0.3.2 removes only the terminal no-progress Effect yield from each traversal, encoding, and copying phase. Every continuing batch retains the 0.3.1 cooperation and host-turn cadence.

The input graph must remain quiescent for the lifetime of each Effect execution. Every execution allocates fresh private traversal and assembly state. Each container's `Reflect.ownKeys` result is captured once, each listed own descriptor is captured once without invoking getters, and already captured observations remain snapshots while traversal continues. This is not an atomic whole-graph snapshot guarantee: concurrent mutation is outside the supported contract. Admission and error precedence remain deterministic over the completed observed snapshot. Interruption discards all private traversal state and partial output; no bytes or text escape.

Property getters are never evaluated. Proxy/reflection failures close to `UnsupportedValue({ reason: "reflection-failure" })`; a cooperative object API cannot make a liveness guarantee for arbitrary hostile proxy traps. Parse hostile bytes into an owner-bounded plain-data value before canonicalization.

### Errors

The closed canonicalization error type is:

```text
CanonicalizationError = InvalidUnicode | UnsupportedValue | CyclicValue
```

- `InvalidUnicode` reports `kind` and an absolute UTF-16 `codeUnitIndex`.
- `UnsupportedValue` reports only a closed `reason` literal.
- `CyclicValue` carries no fields.

Diagnostics are bounded: they contain no rejected text, object keys, object paths, canonical preimages, or raw digest material.

The primary signatures are:

```ts
canonicalize(value: unknown): Effect.Effect<string, CanonicalizationError>
canonicalJsonBytes(value: unknown): Effect.Effect<Uint8Array, CanonicalizationError>
digest(algorithm: DigestAlgorithm, value: unknown): Effect.Effect<string, CanonicalizationError>
digestSchemaValue<A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  algorithm?: DigestAlgorithm
): Effect.Effect<string, CanonicalizationError | ParseResult.ParseError, R>
digestSchemaValueWithByteLimit<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  maximumBytes: number,
  algorithm?: DigestAlgorithm
): Effect.Effect<
  SchemaValueDigest,
  CanonicalByteLimitError | CanonicalizationError | ParseResult.ParseError,
  never
>
digestSchemaValueWithByteLimitSync<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  maximumBytes: number,
  algorithm?: DigestAlgorithm
): Either.Either<
  SchemaValueDigest,
  CanonicalByteLimitError | CanonicalizationError | ParseResult.ParseError
>
```

`digestSchemaValue` first applies `Schema.encode`, then admits and canonicalizes the encoded value. Schema requirements remain in `R`, and `ParseResult.ParseError` remains distinguishable from canonicalization failures.

`digestSchemaValueWithByteLimit` is the resource-qualified form for schemas with no environment requirements. It encodes once and traverses the encoded value once through the same strict JCS authority as the unbounded operation. The JCS machine counts canonical UTF-8 emission and flushes bounded private text segments to a fresh incremental hasher as traversal proceeds, discarding every delivered segment. Emission stops at the first fragment containing byte `maximumBytes + 1`; an oversized preimage is not fully materialized and its partial hasher is never finalized or published. The limit is inclusive, so the exact bound succeeds. Success returns `SchemaValueDigest({ digest, canonicalByteLength })`; `digest` is byte-identical to `digestSchemaValue`, and `canonicalByteLength` is the exact canonical UTF-8 count delivered to the private incremental digest sink.

`maximumBytes` must be a non-negative safe integer. Invalid maxima fail with fieldless, redacted `InvalidCanonicalByteLimit`; excess fails with fieldless, redacted `CanonicalByteLimitExceeded`. `CanonicalByteLimitError` is the closed union of those classifications. RFC 8785 record key ordering and strict descriptor admission require bounded snapshot and sort state for the current container, so this is bounded early canonical UTF-8 emission rather than a second serializer or an independently streamed object-ordering law.

`digestSchemaValueWithByteLimitSync` applies the same law through `Schema.encodeEither` and returns every expected failure as `Either.Left`. It does not run the cooperative Effect driver, Clock, or scheduler and never finalizes or publishes an over-limit digest. It blocks the current JavaScript turn, so use it only for small owner-controlled values at boundaries that cannot acquire an Effect runtime; use `digestSchemaValueWithByteLimit` everywhere else. The byte limit bounds canonical UTF-8 emission, not descriptor admission or key-sort work before emission. Callers admitting untrusted or structurally unbounded inputs need a separate owner-side container/traversal bound before either digest API.

## Text and byte hashing

Text APIs use the same strict UTF-16 validation as canonicalization. Raw-byte APIs accept arbitrary bytes.

| API                                      | Result                                      |
| ---------------------------------------- | ------------------------------------------- |
| `encodeUtf8(text)`                       | `Effect.Effect<Uint8Array, InvalidUnicode>` |
| `digestUtf8(algorithm, text)`            | `Effect.Effect<Uint8Array, InvalidUnicode>` |
| `digestUtf8Base64Url(algorithm, text)`   | `Effect.Effect<string, InvalidUnicode>`     |
| `digestBytes(algorithm, bytes)`          | `Effect.Effect<Uint8Array>`                 |
| `digestBytesBase64Url(algorithm, bytes)` | `Effect.Effect<string>`                     |
| `digestBytesHex(algorithm, bytes)`       | `Effect.Effect<string>`                     |
| `blake3Hash(bytes)`                      | `Effect.Effect<Uint8Array>`                 |
| `sha256(bytes)`                          | `Effect.Effect<Uint8Array>`                 |

`toBase64Url` and `toHex` are pure encoders. `fromBase64Url` and `fromHex` return `Either` with Effect encoding decode errors.

## Streaming

Streaming hashers consume `Stream.Stream` directly and preserve upstream `E` and `R` types:

```ts typecheck
import { digestUtf8Base64Url, digestUtf8StreamBase64Url } from "@scenesystems/digest"
import { Effect, Stream } from "effect"

const program = Effect.gen(function* () {
  const chunks = Stream.fromIterable(["scene-", "\uD83D", "\uDE00"])
  const streamed = yield* digestUtf8StreamBase64Url("blake3-256", chunks)
  const oneShot = yield* digestUtf8Base64Url("blake3-256", "scene-😀")

  return streamed === oneShot
})
```

| API                                            | Error/environment contract                          |
| ---------------------------------------------- | --------------------------------------------------- |
| `digestByteStream(algorithm, chunks)`          | `Effect.Effect<Uint8Array, E, R>`                   |
| `digestByteStreamBase64Url(algorithm, chunks)` | `Effect.Effect<string, E, R>`                       |
| `digestByteStreamHex(algorithm, chunks)`       | `Effect.Effect<string, E, R>`                       |
| `digestUtf8Stream(algorithm, chunks)`          | `Effect.Effect<Uint8Array, E \| InvalidUnicode, R>` |
| `digestUtf8StreamBase64Url(algorithm, chunks)` | `Effect.Effect<string, E \| InvalidUnicode, R>`     |
| `digestUtf8StreamHex(algorithm, chunks)`       | `Effect.Effect<string, E \| InvalidUnicode, R>`     |

Text streams carry at most one trailing high surrogate across chunk boundaries. Valid surrogate pairs split across chunks hash exactly like the one-shot text; malformed text fails with a partition-independent absolute code-unit index.

## Canonical digest helpers

| API                                              | Result                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `digestCanonicalJsonBytes(algorithm, value)`     | canonicalize + hash → `Effect.Effect<Uint8Array, CanonicalizationError>`         |
| `digestCanonicalJsonBase64Url(algorithm, value)` | canonicalize + hash + base64url → `Effect.Effect<string, CanonicalizationError>` |
| `digestCanonicalJsonHex(algorithm, value)`       | canonicalize + hash + hex → `Effect.Effect<string, CanonicalizationError>`       |
| `durableFingerprint(value)`                      | canonical BLAKE3-256 algorithm-tagged text                                       |

## MAC and key derivation

| API                                       | Result                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `blake3Mac(key, message)`                 | BLAKE3 keyed mode; exactly 32-byte key; `InvalidKeyLength` on mismatch          |
| `blake3DeriveKey(context, input, dkLen?)` | BLAKE3 context mode; strict context text; `InvalidUnicode` on malformed context |
| `hmacSha256(key, message)`                | HMAC-SHA256 bytes                                                               |
| `hmacSha256Base64Url(key, message)`       | HMAC-SHA256 base64url                                                           |
| `hmacSha1(key, message)`                  | HMAC-SHA1 bytes for protocols that specify SHA-1                                |
| `hmacSha1Hex(key, message)`               | HMAC-SHA1 lowercase hex                                                         |
| `hkdfSha256(ikm, salt, info, dkLen)`      | RFC 5869 HKDF-SHA256                                                            |
| `hkdfSha512(ikm, salt, info, dkLen)`      | RFC 5869 HKDF-SHA512                                                            |

Secret text must be converted explicitly with `encodeUtf8` or decoded from its wire encoding before use. MAC comparison policy belongs to the caller's protocol implementation.

## Schemas

- `DigestAlgorithm` — `Schema.Literal("blake3-256", "sha256")`
- `Digest256` — branded 43-character base64url text
- `ContentDigest` — `Schema.Class` containing `algorithm` and `digest`
- `InvalidKeyLength`, `InvalidUnicode`, `UnsupportedValue`, `CyclicValue`, and `CanonicalByteLimitExceeded` — `Schema.TaggedError` values
- `CanonicalizationError` — closed Schema and type union

## Runtime and conformance evidence

The packed ESM and CJS artifact is exercised under Node 22, Bun 1.3.9, and Chromium. Those are the release runtime claims; other engines are not implied by this evidence.

Conformance uses checked-in independent upstream vectors rather than outputs generated by this package or Noble at test time:

- RFC 8785 and Cyberphone JCS vectors;
- BLAKE3 reference vectors;
- NIST SHA-256 vectors;
- RFC 4231 HMAC-SHA256 and RFC 2202 HMAC-SHA1 vectors; and
- RFC 5869 and Project Wycheproof HKDF vectors.

`test/fixtures/external/sources.manifest.json` records source revisions, licenses, transformations, exclusions, and local SHA-256 hashes. Repository fixture governance is implemented in TypeScript with Effect.

Noble's audits cover its primitive implementations. They do not replace review of this package's admission rules, option selection, error mapping, or conformance interpretation.

## Development

```sh
bun run check
bun run check:tests
bun run check:examples
bun run lint
bun run test
bun run fixtures:verify
bun run build
bun run publish:check --require-packed-manifest
bun run benchmark:canonicalization:bun
bun run benchmark:canonicalization:node
```

Complete runnable programs are in [`examples/`](./examples).

## Standards

- [RFC 8785 — JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [BLAKE3 specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf)
- [FIPS 180-4 — SHA-256](https://doi.org/10.6028/NIST.FIPS.180-4)
- [RFC 2104 — HMAC](https://www.rfc-editor.org/rfc/rfc2104)
- [RFC 5869 — HKDF](https://www.rfc-editor.org/rfc/rfc5869)

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
