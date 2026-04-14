# @scenesystems/digest

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Cryptographic content hashing and canonicalization for Effect.

Use it when you need stable cache keys, content-addressed artifacts, webhook verification, or deterministic digests for data that has to survive process, machine, or language boundaries.

## Why Use It

- Canonical JSON hashing is built in, so the same structured value produces the same digest even when key order changes.
- BLAKE3-256 is the fast default for internal fingerprints, while SHA-256 is available when external compatibility matters.
- `durableFingerprint` and `digestSchemaValue` turn common identity and schema-aware hashing workflows into one call.
- Streaming helpers and `DigestStreamingLive` let you hash large payloads incrementally instead of buffering everything first.

## Installation

```sh
npm install @scenesystems/digest effect
```

Use `bun add` or `pnpm add` if that is your package manager.

## Quick Start

This is the common path: fingerprint a research artifact for storage, derive a digest from schema-owned data, and compute a transport-safe verification tag.

```ts typecheck
import {
  digest,
  digestSchemaValue,
  durableFingerprint,
  hmacSha256Base64Url,
  utf8ToBytes
} from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const Briefing = Schema.Struct({
  studyId: Schema.String,
  finding: Schema.String,
  createdAt: Schema.DateFromString
})

const program = Effect.gen(function* () {
  const artifactDigest = yield* digest("blake3-256", {
    studyId: "deliberation-s7",
    summary: "Evidence citation increased after rotating facilitation."
  })

  const fingerprint = yield* durableFingerprint({
    artifactDigest,
    routeFamily: "hugging-face",
    stage: "analysis"
  })

  const briefingDigest = yield* digestSchemaValue(Briefing, {
    studyId: "deliberation-s7",
    finding: "Bridge formation dropped during consensus building.",
    createdAt: new Date("2026-04-13T12:00:00.000Z")
  })

  const signature = yield* hmacSha256Base64Url(
    utf8ToBytes("shared-secret"),
    utf8ToBytes(artifactDigest)
  )

  return { artifactDigest, fingerprint, briefingDigest, signature }
})

void program
```

## Main Things You Can Do

| Task | Start here |
| --- | --- |
| Deterministic content addressing | `digest(...)` and `durableFingerprint(...)` for canonicalized, tagged digests |
| Schema-aware hashing | `digestSchemaValue(...)` when value encoding must stay aligned with an Effect Schema |
| Large-payload hashing | `digestByteStream(...)`, `digestUtf8Stream(...)`, `DigestStreaming`, and `DigestStreamingLive` |
| Webhook or transport verification | `hmacSha256Base64Url(...)`, `hmacSha1Hex(...)`, and SHA-256 helpers |
| Key derivation and domain separation | `blake3DeriveKey(...)`, `hkdfSha256(...)`, and `hkdfSha512(...)` |
| Raw encoding utilities | `utf8ToBytes(...)`, `toBase64Url(...)`, `fromBase64Url(...)`, `toHex(...)`, and `fromHex(...)` |

## Learn More

- Start with [`examples/03-content-addressing.ts`](./examples/03-content-addressing.ts) for canonicalization, `digest`, `durableFingerprint`, and `digestSchemaValue`.
- Use [`examples/04-streaming-digest.ts`](./examples/04-streaming-digest.ts) for the streaming helpers and chunk-parity story.
- Use [`examples/02-webhook-verification.ts`](./examples/02-webhook-verification.ts) for HMAC-backed verification flows.
- Conformance is fixture-backed rather than README-backed: `bun run fixtures:check`, `bun run fixtures:generate`, `bun run fixtures:stamp`, and `bun run fixtures:verify` keep the cross-language surface honest.
- From the repository root, run `bun run docs:packages -- --package @scenesystems/digest --view agent` for the generated docs surface.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
