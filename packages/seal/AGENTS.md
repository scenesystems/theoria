---
description: Development guidelines for @scenesystems/seal
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/seal

Authenticated encryption for Effect.

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |

All four gates must pass clean before any work is considered complete.

## Architecture

Single entrypoint — `@scenesystems/seal`. Effect is a required
peer dependency. Schema is the single source of truth for all types.

### Modules

- `src/algorithms/xchacha20.ts` — XChaCha20-Poly1305 AEAD (recommended default)
- `src/algorithms/aesgcmsiv.ts` — AES-256-GCM-SIV (nonce-misuse resistant)
- `src/algorithms/aesgcm.ts` — AES-256-GCM (compatibility)
- `src/seal.ts` — unified encrypt/decrypt pipeline with algorithm selection
- `src/encoding.ts` — sealed envelope serialization (prepended nonce + ciphertext + tag)

### Schemas (`src/schemas/`)

- `src/schemas/SealAlgorithm.ts` — `Schema.Literal("xchacha20-poly1305", "aes-256-gcm-siv", "aes-256-gcm")`
- `src/schemas/SealedEnvelope.ts` — `Schema.Class` with algorithm, nonce, ciphertext
- `src/schemas/errors.ts` — `Schema.TaggedError` types (DecryptionFailed, InvalidKey)
- `src/schemas/sealEffect.ts` — Effect-wrapped encrypt/decrypt operations

### Internal (`src/internal/`)

Private implementation. Blocked from consumers via exports map.

- `src/internal/nonce.ts` — nonce generation and management
- `src/internal/keyValidation.ts` — key length validation per algorithm

## Conventions

- **Effect-native discipline** — no async/await, throw/try-catch, new Error(), console.*, let, for/while, switch
- **Tests always use `@effect/vitest`** with `it.effect()` for schema tests
- **Schema is the single source of truth** — types are defined as Schema in `src/schemas/`, extracted via `Schema.Type` and `import type`
- **256-bit keys only** — all three algorithms use 32-byte keys

## Governance

- `internal/*` blocked from consumers via exports map
- No `@noble/ciphers` types leak through public surface
- 240 LOC file-size limit applies
