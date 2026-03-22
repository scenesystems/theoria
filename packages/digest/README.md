# @scenesystems/digest

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Cryptographic content hashing and canonicalization for the [Theoria](https://github.com/scenesystems/theoria) ecosystem.

## Features

- **BLAKE3-256** primary digest algorithm
- **SHA-256** secondary for compatibility
- **RFC 8785 JCS** canonicalization for deterministic structured data hashing
- **base64url** encoding (43 chars, no padding)
- **Dual entrypoint** — pure core (zero Effect) and Effect Schema layer
- **Branded types** — `Digest256`, `ContentDigest`, `DigestAlgorithm`

## Install

```sh
bun add @scenesystems/digest
```

## Usage

### Core (no Effect required)

```ts
import { blake3, canonicalize } from "@scenesystems/digest"

const hash = blake3(canonicalize({ key: "value" }))
```

### Schema (Effect integration)

```ts
import { durableFingerprint } from "@scenesystems/digest/schema"
import { Effect } from "effect"

const key = durableFingerprint({ question: "What is 2+2?" })
// Effect<string, FingerprintUnsupportedValue>
```

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
