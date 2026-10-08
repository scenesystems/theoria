# @scenesystems/digest

Digest provides hashing and key derivation for [Effect](https://effect.website) programs using [Noble Hashes](https://paulmillr.com/noble/). It can hash exact bytes or identify structured data through a Schema and RFC 8785 canonical JSON. Text encoding rejects malformed Unicode.

## Installation

```sh
bun add @scenesystems/digest effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/digest/ContentDigest`.

## Basic use

Hash UTF-8 text with BLAKE3. Operations return lazy Effects with typed validation failures.

```ts typecheck
import { Digest, Utf8 } from "@scenesystems/digest"
import { Effect } from "effect"
import { Hex } from "effect/encoding"

export const program = Effect.gen(function* () {
  const bytes = yield* Utf8.encode("hello")
  const hash = yield* Digest.hash("blake3-256", bytes)
  return Hex.encode(hash)
})
```

[`Digest`](./src/Digest.ts) supports `"blake3-256"` and `"sha256"`, both producing 32 bytes. `hashString` validates text before hashing. For large inputs, `hashStream` and `hashStringStream` process chunks incrementally while preserving upstream errors and service requirements. Use Effect's `Hex`, `Base64`, or `Base64Url` for wire encodings.

[`Utf8`](./src/Utf8.ts) rejects malformed Unicode rather than replacing it. Valid text is preserved without normalization; streaming text can split a surrogate pair across chunks.

## Identify structured content

Choose a Schema that defines the representation whose identity matters:

```ts typecheck
import { ContentDigest } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const Document = Schema.Struct({
  domain: Schema.Literal("document"),
  text: Schema.String,
  createdAt: Schema.DateFromString
})

export const identify = (document: typeof Document.Type) =>
  ContentDigest.fromSchema(Document, document).pipe(Effect.map(ContentDigest.toString))
```

`fromSchema` hashes the Schema's encoded value as canonical JSON, using BLAKE3-256 by default. In this example, the date becomes a string before hashing. Schema encoding failures and service requirements remain in the returned Effect. `toString` includes the algorithm in the result: `<algorithm>:<base64url>`.

Choose the Schema's fields and transformations to match the content you want to identify. Schema identifiers do not contribute to the digest. Use `fromBytes` to hash exact bytes without encoding or canonicalization.

For a canonical byte budget, use `fromSchemaWithByteLimit`:

```ts typecheck
import { ContentDigest } from "@scenesystems/digest"
import { Number, Schema } from "effect"

const Payload = Schema.Struct({ id: Schema.String, tags: Schema.Array(Schema.String) })

export const identifyBounded = (payload: typeof Payload.Type) =>
  ContentDigest.fromSchemaWithByteLimit(Payload, payload, Number.multiply(64, 1024))
```

The result includes the digest and `canonicalByteLength`. Values exceeding the inclusive byte limit fail with a typed error. Because encoding and key sorting can consume resources before bytes are emitted, untrusted inputs also need structural limits. See [`ContentDigest`](./src/ContentDigest.ts) for the result and error types.

## Canonical JSON

[`CanonicalJson`](./src/CanonicalJson.ts) exposes canonical text and bytes when hashing is not needed. It accepts JSON-compatible values with finite numbers, well-formed strings, dense arrays, and own enumerable string-keyed records. Encode dates, bigints, collections, and domain models through a suitable Schema first.

Keys sort by UTF-16 code units as RFC 8785 requires. Strings are not normalized or repaired. Unsupported values, cycles, and malformed Unicode fail explicitly. Keep the input graph unchanged until the Effect completes. Traversal yields cooperatively, but key sorting and synchronous Schema transforms are not preemptible.

## Authenticate messages and derive keys

Hashing alone does not authenticate. [`Hmac`](./src/Hmac.ts) provides SHA-256 authentication; [`Blake3`](./src/Blake3.ts) provides keyed hashing and domain-separated derivation. [`Hkdf`](./src/Hkdf.ts) derives keys with SHA-256 or SHA-512.

```ts typecheck
import { Hmac, Utf8 } from "@scenesystems/digest"
import { Effect } from "effect"

export const authenticate = (key: Uint8Array, body: string) =>
  Utf8.encode(body).pipe(Effect.flatMap((message) => Hmac.sha256(key, message)))
```

Store and rotate keys securely, and compare authenticators in constant time. Your protocol must bind the algorithm and key identity to the message's intended use. Set output-length limits appropriate to that protocol.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Content hashing](./examples/01-content-hashing.ts)
- [Webhook HMAC](./examples/02-webhook-verification.ts)
- [Content addressing](./examples/03-content-addressing.ts)
- [Streaming](./examples/04-streaming-digest.ts)

## Verification

Conformance tests use RFC 8785, BLAKE3, FIPS 180-4, HMAC, and HKDF references, including NIST and Wycheproof vectors. [Fixture provenance](./test/fixtures/external/sources.manifest.json) records revisions, licenses, and transformations. From this package, `bun run fixtures:verify` checks source hashes and conformance tests.

For local throughput measurements, run `OUTPUT=.tmp/digest-throughput.jsonl bash packages/digest/benchmark/throughput.sh node bun` from the repository root on an idle host. The [runner](./benchmark/throughput.sh) writes raw samples and candidate/oracle ratios and exits nonzero when a ratio exceeds 1. The whole-preimage oracle does less admission and cooperative work; its ratio is diagnostic, not a comparison with a published release.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
