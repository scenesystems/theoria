# @scenesystems/digest

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Cryptographic content hashing and canonicalization for [Effect](https://effect.website). Built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem.

## Install

```sh
bun add @scenesystems/digest
```

Requires `effect` ≥ 3.20.0 as a peer dependency.

## Why this package?

Content-addressing, cache identity, and artifact integrity all require the same three-stage pipeline: **canonicalize** structured data into a deterministic byte sequence, **hash** it with a cryptographic digest, and **encode** the result for storage or transport. `@scenesystems/digest` composes these stages into a single Effect-native API with typed errors, branded schemas, and zero runtime dependencies beyond `@noble/hashes`.

- **BLAKE3-256** primary — fastest secure hash, native domain separation via context mode
- **SHA-256** secondary — FIPS compatibility, webhook verification, API key hashing
- **RFC 8785 JCS** canonicalization — cross-language deterministic JSON serialization
- **base64url** encoding — URL-safe, 43 chars for 256-bit digests, no padding

### Choosing an algorithm

Use **BLAKE3-256** for internal content-addressing, cache keys, artifact integrity, and anywhere you control both producer and consumer. It's faster than SHA-256 and provides built-in domain separation through context mode — no manual salt concatenation needed.

Use **SHA-256** when interacting with external systems that expect it: webhook signature verification (Stripe, GitHub), API key hashing for database lookup, or regulatory contexts where FIPS familiarity matters.

## Quick start

```ts
import { digest, durableFingerprint } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Full pipeline: canonicalize → hash → base64url → algorithm tag
  const tagged = yield* digest("blake3-256", { user: "alice", score: 42 })
  // "blake3-256:eT9Imnjd2CADODvozkIZQ3Cyt0k9yWL5A5rk3HlVTxo"

  // Durable cache key fingerprint (BLAKE3-256)
  const key = yield* durableFingerprint({ question: "What is 2+2?" })
  // "blake3-256:JKgumbizHUBR-kvvgYdMpe4m6sQ-2m3W-y7fZBS20JY"
})
```

## API

### Algorithms

| Function                                  | Description                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `blake3Hash(bytes)`                       | BLAKE3-256 hash → `Effect<Uint8Array>`                                  |
| `blake3Mac(key, message)`                 | BLAKE3 keyed MAC (32-byte key) → `Effect<Uint8Array, InvalidKeyLength>` |
| `blake3DeriveKey(context, input, dkLen?)` | BLAKE3 KDF with domain separation → `Effect<Uint8Array>`                |
| `sha256(bytes)`                           | SHA-256 hash → `Effect<Uint8Array>`                                     |

### Convenience digest functions

| Function                                 | Description                                |
| ---------------------------------------- | ------------------------------------------ |
| `digestBytes(algorithm, bytes)`          | Hash raw bytes → `Effect<Uint8Array>`      |
| `digestUtf8(algorithm, text)`            | Hash a UTF-8 string → `Effect<Uint8Array>` |
| `digestBytesBase64Url(algorithm, bytes)` | Hash + base64url encode → `Effect<string>` |
| `digestUtf8Base64Url(algorithm, text)`   | Hash string + base64url → `Effect<string>` |
| `digestBytesHex(algorithm, bytes)`       | Hash + hex encode → `Effect<string>`       |

### Canonicalization

| Function                    | Description                           |
| --------------------------- | ------------------------------------- |
| `canonicalize(value)`       | RFC 8785 JCS → canonical JSON string  |
| `canonicalJsonBytes(value)` | JCS → UTF-8 bytes (ready for hashing) |

### Content-addressing pipelines

| Function                                       | Description                                            |
| ---------------------------------------------- | ------------------------------------------------------ |
| `digest(algorithm, value)`                     | Canonicalize → hash → base64url → `"algorithm:digest"` |
| `digestSchemaValue(schema, value, algorithm?)` | Schema.encode → JCS → hash (default BLAKE3-256)        |
| `durableFingerprint(value)`                    | Canonical BLAKE3-256 fingerprint for cache keys        |

### Message authentication (HMAC)

| Function                            | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `hmacSha256(key, message)`          | HMAC-SHA256 → `Effect<Uint8Array>`          |
| `hmacSha1(key, message)`            | HMAC-SHA1 (legacy) → `Effect<Uint8Array>`   |
| `hmacSha256Base64Url(key, message)` | HMAC-SHA256 + base64url → `Effect<string>`  |
| `hmacSha1Hex(key, message)`         | HMAC-SHA1 + hex (legacy) → `Effect<string>` |

### Key derivation (HKDF)

| Function                             | Description                                   |
| ------------------------------------ | --------------------------------------------- |
| `hkdfSha256(ikm, salt, info, dkLen)` | HKDF-SHA256 (RFC 5869) → `Effect<Uint8Array>` |
| `hkdfSha512(ikm, salt, info, dkLen)` | HKDF-SHA512 (RFC 5869) → `Effect<Uint8Array>` |

### Encoding

| Function             | Description                           |
| -------------------- | ------------------------------------- |
| `utf8ToBytes(str)`   | UTF-8 string → `Uint8Array`           |
| `toBase64Url(bytes)` | Bytes → base64url string (no padding) |
| `fromBase64Url(str)` | Base64url string → bytes              |
| `toHex(bytes)`       | Bytes → lowercase hex string          |
| `fromHex(hex)`       | Hex string → bytes                    |

### Schema types

| Type              | Description                                     |
| ----------------- | ----------------------------------------------- |
| `DigestAlgorithm` | `Schema.Literal("blake3-256", "sha256")`        |
| `Digest256`       | Branded 43-char base64url string                |
| `ContentDigest`   | Schema.Class with `algorithm` + `digest` fields |

### Errors

| Error                         | Raised by                                                               |
| ----------------------------- | ----------------------------------------------------------------------- |
| `InvalidKeyLength`            | `blake3Mac` when key ≠ 32 bytes                                         |
| `FingerprintUnsupportedValue` | `canonicalize`, `digest`, `durableFingerprint` for non-JSON-safe values |

## Examples

### Content hashing

```ts
import { blake3Hash, digestUtf8, toBase64Url, utf8ToBytes } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Raw BLAKE3 hash with manual encoding
  const hash = yield* blake3Hash(utf8ToBytes("hello"))
  const encoded = yield* toBase64Url(hash) // 43-char base64url

  // Convenience: string → hash in one call
  const same = yield* digestUtf8("blake3-256", "hello")
})
```

### Webhook signature verification

```ts
import { hmacSha256Base64Url, utf8ToBytes } from "@scenesystems/digest"
import { Effect } from "effect"

const verifyWebhook = (secret: string, payload: string, expectedSig: string) =>
  Effect.gen(function* () {
    const computed = yield* hmacSha256Base64Url(utf8ToBytes(secret), utf8ToBytes(payload))
    return computed === expectedSig
  })
```

### Schema-aware content addressing

```ts
import { digestSchemaValue } from "@scenesystems/digest"
import { Effect, Schema } from "effect"

const Event = Schema.Struct({
  action: Schema.String,
  createdAt: Schema.DateFromString
})

const program = Effect.gen(function* () {
  // Date is encoded to ISO string before hashing
  const fingerprint = yield* digestSchemaValue(Event, { action: "deploy", createdAt: new Date("2025-01-15T12:00:00Z") })
  // "blake3-256:<base64url>" — deterministic across runs
})
```

### BLAKE3 domain-separated key derivation

```ts
import { blake3DeriveKey, blake3Mac } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Derive a key from context string + input (no salt needed)
  const derived = yield* blake3DeriveKey("myapp/cache-v1", new Uint8Array(32))

  // Keyed MAC with a 32-byte key
  const mac = yield* blake3Mac(derived, new Uint8Array([1, 2, 3]))
})
```

### HKDF key derivation

```ts
import { hkdfSha256, utf8ToBytes } from "@scenesystems/digest"
import { Effect, Option } from "effect"

const program = Effect.gen(function* () {
  const sharedSecret = new Uint8Array(32) // e.g., from X25519 key agreement
  const salt = Option.some(crypto.getRandomValues(new Uint8Array(32)))
  const info = utf8ToBytes("aes-256-gcm-key")

  const aesKey = yield* hkdfSha256(sharedSecret, salt, info, 32)
  // salt is Option<Uint8Array> — Option.none() uses zero-bytes per RFC 5869
})
```

### Error handling

```ts
import { blake3Mac, canonicalize, FingerprintUnsupportedValue, InvalidKeyLength } from "@scenesystems/digest"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // canonicalize rejects non-JSON-safe values with a typed error
  const result = yield* canonicalize({ key: "value" }).pipe(
    Effect.catchTag("FingerprintUnsupportedValue", (e) => Effect.succeed(`rejected: ${e.valueType} — ${e.reason}`))
  )

  // blake3Mac rejects wrong-length keys
  const mac = yield* blake3Mac(new Uint8Array(16), new Uint8Array(0)).pipe(
    Effect.catchTag("InvalidKeyLength", (e) => Effect.succeed(`expected ${e.expected} bytes, got ${e.actual}`))
  )
})
```

See the [`examples/`](./examples) directory for complete runnable programs.

## Cryptographic foundations

All primitives wrap the [Noble](https://paulmillr.com/noble/) cryptographic ecosystem — independently audited by Cure53 and Trail of Bits, zero-dependency, high-performance pure JavaScript implementations.

| Dependency      | Audits   | Purpose                     |
| --------------- | -------- | --------------------------- |
| `@noble/hashes` | 6 audits | BLAKE3, SHA-256, HMAC, HKDF |
| `@scure/base`   | 2 audits | base64url encoding          |

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
