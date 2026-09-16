# @scenesystems/digest

`@scenesystems/digest` provides strict UTF-8, RFC 8785 canonical JSON, cryptographic hashes, content digest models, HMAC, and key derivation for [Effect](https://effect.website) programs. Cryptographic kernels come from audited [Noble Hashes](https://paulmillr.com/noble/).

## Installation

```sh
npm install @scenesystems/digest effect
```

Effect `^3.22.1` is a required peer dependency.

## Imports

The root exposes concern namespaces:

```ts typecheck
import { CanonicalJson, ContentDigest, Digest, Utf8 } from "@scenesystems/digest"
```

Every namespace also has a matching tree-shakeable subpath:

```ts typecheck
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as Digest from "@scenesystems/digest/Digest"
```

Supported names are `Digest`, `ContentDigest`, `CanonicalJson`, `Utf8`, `Blake3`, `Hmac`, and `Hkdf`. Internal and legacy flat paths are not public.

## Choose the right result channel

The API distinguishes deterministic work from validation and cooperative effects:

| Shape    | Operations                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Pure     | `Digest.hash`, `ContentDigest.fromBytes`, `Hmac.sha256`, `Hmac.sha1`                                                  |
| `Either` | `Utf8.encode`, `Utf8.fromScalar`, `Digest.hashString`, `Blake3.mac`, `Blake3.deriveKey`, `Hkdf.sha256`, `Hkdf.sha512` |
| `Effect` | stream hashing, canonical JSON, unknown-value digests, and Schema-value digests                                       |

This keeps raw byte hashing allocation-only, makes local input validation explicit, and leaves interruption, upstream failures, and service requirements in `Effect`.

## Raw bytes and strict text

`Digest.hash(algorithm, bytes)` returns raw 32-byte output. `Digest.hashString` first performs strict UTF-8 validation and therefore returns an `Either` with `Utf8.InvalidUnicode`.

```ts typecheck
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Encoding } from "effect"

export const program = Effect.gen(function* () {
  const bytes = yield* Utf8.encode("hello")
  const byteHash = Digest.hash("blake3-256", bytes)
  const textHash = yield* Digest.hashString("sha256", "hello")

  return {
    blake3Hex: Encoding.encodeHex(byteHash),
    sha256Base64Url: Encoding.encodeBase64Url(textHash)
  }
})
```

There are no package-specific hex or base64 conveniences. Compose `Encoding.encodeHex`, `Encoding.encodeBase64Url`, `Encoding.decodeHex`, or `Encoding.decodeBase64Url` from Effect.

`Digest.hashStream(algorithm, byteStream)` and `Digest.hashStringStream(algorithm, textStream)` hash incrementally. Both preserve the stream's error and requirement types. The text stream handles surrogate pairs split across chunks and reports malformed text at its absolute UTF-16 code-unit index.

## Content digests

`ContentDigest.ContentDigest` is a `Schema.Class` with two fields:

- `algorithm: Digest.Algorithm`, currently `"blake3-256" | "sha256"`
- `digest: ContentDigest.Value`, a branded canonical 43-character unpadded base64url value

The model is not the wire string. Call `ContentDigest.toString(model)` at protocol boundaries to produce `<algorithm>:<base64url>`.

```ts typecheck
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Effect } from "effect"

export const identify = (value: unknown) =>
  ContentDigest.fromUnknown("blake3-256", value).pipe(Effect.map(ContentDigest.toString))
```

`ContentDigest.fromBytes` hashes its input bytes directly and is pure. `ContentDigest.fromUnknown` canonicalizes an admitted runtime value before hashing and returns an `Effect<ContentDigest, CanonicalJson.Error>`. For a durable fingerprint, use `fromUnknown("blake3-256", value)` and then `toString`; there is no separate fingerprint helper.

### Schema values

Runtime values such as dates and transformed domain models must be encoded through their owner-selected Schema before hashing:

```ts typecheck
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Effect, Schema } from "effect"

const Event = Schema.Struct({
  name: Schema.String,
  occurredAt: Schema.DateFromString
})

export const eventId = (event: typeof Event.Type) =>
  ContentDigest.fromSchema(Event, event).pipe(Effect.map(ContentDigest.toString))
```

`fromSchema(schema, value, algorithm?)` delegates to `Schema.encode`, preserves the Schema's service requirements, and defaults to BLAKE3-256. Its error channel includes `ParseResult.ParseError` and `CanonicalJson.Error`.

For large preimages, `fromSchemaWithByteLimit(schema, value, maximumBytes, algorithm?)` returns a `ContentDigest.Result` containing `digest` and exact `canonicalByteLength`. `fromSchemaWithByteLimitEither` has the same arguments and uses `Schema.encodeEither` for synchronous, service-free schemas.

```ts typecheck
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Effect, Schema } from "effect"

const Payload = Schema.Struct({ id: Schema.String, tags: Schema.Array(Schema.String) })

export const bounded = (payload: typeof Payload.Type) =>
  ContentDigest.fromSchemaWithByteLimit(Payload, payload, 64 * 1024).pipe(
    Effect.map(({ canonicalByteLength, digest }) => ({
      canonicalByteLength,
      id: ContentDigest.toString(digest)
    })),
    Effect.catchTag("CanonicalByteLimitExceeded", () => Effect.succeed({ canonicalByteLength: -1, id: "too-large" }))
  )
```

The limit is inclusive and counts serializer-emitted UTF-8 segments. It stops before constructing the complete oversized output. It does not bound Schema encoding, key sorting, input graph traversal, property count, or work inside one emitted segment; apply structural limits before canonicalization for untrusted data.

## Canonical JSON

`CanonicalJson.encode(value)` returns canonical text, and `CanonicalJson.encodeBytes(value)` returns its strict UTF-8 bytes. Both are cooperative Effects and fail with `CanonicalJson.Error`, the closed union of:

- `Utf8.InvalidUnicode`
- `CanonicalJson.UnsupportedValue`
- `CanonicalJson.CyclicValue`

The admission law accepts `null`, booleans, finite numbers, well-formed strings, dense arrays, and own enumerable string-keyed record values. Keys sort by UTF-16 code units as RFC 8785 requires. Inherited, non-enumerable, symbol-keyed, and non-element array properties are ignored.

Unsupported values include `undefined`, non-finite numbers, bigint, functions, symbols, sparse arrays, typed arrays, dates, regular expressions, maps, and sets. Convert those values through a Schema to their intended wire form. Strings are never normalized or repaired. Errors carry bounded diagnostics and do not include rejected text, keys, paths, or preimages.

Traversal is stack-safe and yields between bounded batches. Record key collection and sorting, synchronous Schema transforms, final string joining, and final UTF-8 materialization remain synchronous. The caller must keep the visible input graph stable until the Effect completes.

Byte-limit failures use `CanonicalJson.ByteLimitError`: `InvalidByteLimit` or `ByteLimitExceeded`. Their serialized `_tag` values remain `InvalidCanonicalByteLimit` and `CanonicalByteLimitExceeded` for wire compatibility.

## UTF-8 and Unicode scalars

`Utf8.encode(text)` returns `Either<Uint8Array, Utf8.InvalidUnicode>`. It preserves valid text exactly and reports a lone surrogate's UTF-16 code-unit index.

`Utf8.Scalar` is the numeric Schema and brand for Unicode scalar values: integers from 0 through `0x10FFFF`, excluding the surrogate range. `Utf8.fromScalar(number)` validates before constructing text and returns `Either<string, ParseResult.ParseError>`. NUL, controls, unassigned scalars, noncharacters, and U+FEFF remain valid; no normalization occurs.

## Authentication and key derivation

Hashing does not authenticate. `Hmac.sha256(key, message)` and protocol-compatibility `Hmac.sha1(key, message)` return bytes directly. `Blake3.mac(key, message)` returns an `Either` because BLAKE3 keyed mode requires a 32-byte key.

`Hkdf.sha256(ikm, salt, info, length)` and `Hkdf.sha512` accept `Option<Uint8Array>` salt and return `Either<Uint8Array, Hkdf.InvalidLength>`. `Option.none()` supplies a hash-length zero salt. The inclusive output ranges are 0–8160 and 0–16320 bytes respectively. `Blake3.deriveKey(context, input, length?)` defaults to 32 bytes and admits non-negative safe-integer lengths; impose an application-specific allocation limit for external requests. It reports `Utf8.InvalidUnicode` or `Blake3.InvalidLength`; allocation failures remain runtime defects.

```ts typecheck
import * as Hmac from "@scenesystems/digest/Hmac"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Encoding } from "effect"

export const authenticate = Effect.gen(function* () {
  const key = yield* Utf8.encode("shared secret")
  const message = yield* Utf8.encode("webhook body")
  return Encoding.encodeBase64Url(Hmac.sha256(key, message))
})
```

Compare authenticators using the surrounding protocol's constant-time comparison and bind algorithm, key identity, and message domain there. Key storage, rotation, and secret lifecycle are application responsibilities.

## Standards and provenance

The suite checks RFC 8785 JCS, the BLAKE3 specification, FIPS 180-4 SHA-256, RFC 2104 HMAC, and RFC 5869 HKDF, with vectors from RFC 4231, RFC 2202, NIST CAVP, and Project Wycheproof. Fixture source revisions, licenses, transformations, exclusions, verdict mappings, and local hashes live in [`test/fixtures/external/sources.manifest.json`](./test/fixtures/external/sources.manifest.json).

Tests exercise the supported concern imports. Smaller suites live in `test/Blake3.test.ts`, `test/Hmac.test.ts`, and `test/Hkdf.test.ts`; larger suites use concern directories with operation or behavior names. [`scripts/fixtures.ts`](./scripts/fixtures.ts) owns fixture decoding, provenance validation, and loading for both tests and scripts. Run `bun run fixtures:verify` from this package to check all source hashes and execute the conformance suites.

## Examples

- [content hashing](./examples/01-content-hashing.ts)
- [webhook HMAC](./examples/02-webhook-verification.ts)
- [content addressing](./examples/03-content-addressing.ts)
- [streaming digests](./examples/04-streaming-digest.ts)

This package is pre-1.0. Pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
