# .vendor/ — Vendored Source Subtrees for Agent Reference

This directory contains **read-only source subtrees** of key dependencies, synced to the exact versions installed in this project. These exist so that AI coding agents can directly read upstream source code without internet access.

## How to Use (for Agents)

When you need to understand how an API works internally, **read the source directly** — don't guess export maps, module paths, or function signatures.

### Effect

```
Read .vendor/effect/packages/effect/src/Schema.ts
Read .vendor/effect/packages/effect/src/Effect.ts
Read .vendor/effect/packages/effect/src/Data.ts
Read .vendor/effect/packages/effect/src/Match.ts
Read .vendor/effect/packages/experimental/src/VariantSchema.ts
```

| npm package            | Source directory                              |
| ---------------------- | -------------------------------------------- |
| `effect`               | `.vendor/effect/packages/effect/src/`        |
| `@effect/experimental` | `.vendor/effect/packages/experimental/src/`  |
| `@effect/platform`     | `.vendor/effect/packages/platform/src/`      |
| `@effect/platform-bun` | `.vendor/effect/packages/platform-bun/src/`  |
| `@effect/vitest`       | `.vendor/effect/packages/vitest/src/`        |
| `@effect/typeclass`    | `.vendor/effect/packages/typeclass/src/`     |
| `@effect/printer-ansi` | `.vendor/effect/packages/printer-ansi/src/`  |
| `@effect/ai`           | `.vendor/effect/packages/ai/ai/src/`         |
| `@effect/ai-openai`    | `.vendor/effect/packages/ai/openai/src/`     |
| `@effect/ai-anthropic` | `.vendor/effect/packages/ai/anthropic/src/`  |

### Noble Cryptography

When working with `@noble/*` packages, **always read the source first** to verify export maps, module paths (`.js` extensions required in v2+), and breaking changes between versions.

```
Read .vendor/noble-hashes/src/sha2.ts
Read .vendor/noble-hashes/src/blake3.ts
Read .vendor/noble-hashes/src/legacy.ts        # sha1, md5, ripemd160 live here in v2
Read .vendor/noble-hashes/src/hmac.ts
Read .vendor/noble-hashes/src/utils.ts
Read .vendor/noble-hashes/package.json          # check exports map for valid import paths
Read .vendor/noble-curves/src/p256.ts
Read .vendor/noble-curves/src/ed25519.ts
Read .vendor/noble-ciphers/src/aes.ts
Read .vendor/noble-post-quantum/src/ml-kem.ts
Read .vendor/noble-post-quantum/src/ml-dsa.ts
Read .vendor/scure-base/src/index.ts
```

| npm package            | Source directory               | Used by         |
| ---------------------- | ----------------------------- | --------------- |
| `@noble/hashes`        | `.vendor/noble-hashes/src/`   | digest, sign    |
| `@noble/curves`        | `.vendor/noble-curves/src/`   | sign            |
| `@noble/ciphers`       | `.vendor/noble-ciphers/src/`  | seal            |
| `@noble/post-quantum`  | `.vendor/noble-post-quantum/src/` | sign        |
| `@scure/base`          | `.vendor/scure-base/src/`     | digest, seal    |

### Critical: Noble v2 Import Paths

Noble v2 requires `.js` extensions in import specifiers:

```ts
// ✅ Correct
import { sha256 } from "@noble/hashes/sha2.js"
import { blake3 } from "@noble/hashes/blake3.js"
import { sha1 } from "@noble/hashes/legacy.js"    // NOT sha1.js

// ❌ Wrong — will fail at runtime
import { sha256 } from "@noble/hashes/sha2"
import { sha1 } from "@noble/hashes/sha1"          // moved to legacy.js in v2
```

Always check `package.json` exports map in the vendored source to verify valid import paths.

### Internal vs Public

- `src/*.ts` — public API modules (what you import)
- `src/internal/` — private implementation details (not exported, but useful for understanding behavior)

## Rules

- **NEVER modify files in `.vendor/`** — they are synced from upstream
- **NEVER import from `.vendor/`** — use normal `import { ... } from "@noble/hashes/sha2.js"` etc.
- These files exist solely for agent reference and source understanding
- Version is pinned in `.vendor/vendor.json` and must match installed packages

## Sync

```bash
bun run vendor:check   # see if versions drifted
bun run vendor:sync    # sync subtrees to installed versions
```
