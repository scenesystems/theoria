# @scenesystems/digest

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Cryptographic content hashing and canonicalization for the [Theoria](https://github.com/scenesystems/theoria) ecosystem.

## Features

- **BLAKE3-256** primary digest algorithm
- **SHA-256** secondary for compatibility
- **RFC 8785 JCS** canonicalization for deterministic structured data hashing
- **base64url** encoding (43 chars, no padding)
- **Effect-native** — Schema-typed values, typed errors, Effect pipelines
- **Branded types** — `Digest256`, `ContentDigest`, `DigestAlgorithm`

## Install

```sh
bun add @scenesystems/digest effect
```

## Usage

```ts
import { blake3Hash, canonicalize, digest, durableFingerprint } from "@scenesystems/digest"
import { Effect } from "effect"

// Pure hash
const hash = blake3Hash(canonicalize({ key: "value" }))

// Unified pipeline
const tagged = digest("blake3-256", { key: "value" })

// Effect-wrapped fingerprint
const key = durableFingerprint({ question: "What is 2+2?" })
// Effect<string, FingerprintUnsupportedValue>
```

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
