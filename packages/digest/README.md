# @scenesystems/digest

Hash bytes and text, identify structured content, and derive keys in [Effect](https://effect.website) programs. The package combines strict UTF-8, RFC 8785 canonical JSON, BLAKE3, SHA-256, HMAC, and HKDF using [Noble Hashes](https://paulmillr.com/noble/).

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

`fromSchema` encodes the value, canonicalizes the encoded representation, and hashes it with BLAKE3-256 by default. It retains the codec's encoding requirements and failures. The result is an algorithm-tagged model; `toString` produces `<algorithm>:<base64url>` for protocol boundaries.

The Schema determines identity fields and transformations. Only encoded data contributes to identity; Schema identifiers are not added automatically. Changing the encoded representation changes its digest. Use `fromBytes` when identity is over exact bytes rather than structured data.

For a canonical byte budget, use `fromSchemaWithByteLimit`:

```ts typecheck
import { ContentDigest } from "@scenesystems/digest"
import { Number, Schema } from "effect"

const Payload = Schema.Struct({ id: Schema.String, tags: Schema.Array(Schema.String) })

export const identifyBounded = (payload: typeof Payload.Type) =>
  ContentDigest.fromSchemaWithByteLimit(Payload, payload, Number.multiply(64, 1024))
```

This returns the digest and `canonicalByteLength`, or a typed limit failure. The inclusive limit bounds emitted canonical bytes, not Schema work, input traversal, or key sorting. Apply structural limits to untrusted inputs too. See [`ContentDigest`](./src/ContentDigest.ts) for result models and exact operation contracts.

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

Supply a securely managed key. Compare authenticators with the protocol's constant-time comparison and bind algorithm, key identity, and message domain there. Applications own key storage, rotation, and output-length limits.

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
