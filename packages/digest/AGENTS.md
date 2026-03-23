---
description: Development guidelines for @scenesystems/digest
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/digest

Cryptographic content hashing and canonicalization for Effect.

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |

All four gates must pass clean before any work is considered complete.

## Architecture

Single entrypoint — `@scenesystems/digest`. Effect is a required
peer dependency. Schema is the single source of truth for all types.

### Modules

- `src/algorithms/blake3.ts` — BLAKE3 multi-mode: hash, keyed MAC, derive_key KDF
- `src/algorithms/sha256.ts` — SHA-256 digest
- `src/canonicalize.ts` — RFC 8785 JCS canonicalization
- `src/encoding.ts` — base64url encode/decode
- `src/digest.ts` — unified canonicalize → hash → encode pipeline
- `src/hmac.ts` — HMAC-SHA256 and HMAC-SHA1 message authentication
- `src/kdf.ts` — HKDF-SHA256 and HKDF-SHA512 key derivation (RFC 5869)

### Schemas (`src/schemas/`)

- `src/schemas/DigestAlgorithm.ts` — `Schema.Literal("blake3-256", "sha256")`
- `src/schemas/Digest256.ts` — branded 43-char base64url schema
- `src/schemas/ContentDigest.ts` — algorithm-tagged digest pair
- `src/schemas/durableFingerprint.ts` — Effect-wrapped canonical fingerprinting
- `src/schemas/errors.ts` — `Schema.TaggedError` types

### Internal (`src/internal/`)

Private implementation. Blocked from consumers via exports map.

- `src/internal/bytes.ts` — UTF-8 encoding, buffer ops
- `src/internal/jcs.ts` — recursive JCS engine
- `src/internal/validation.ts` — input guards

## Conventions

- **Effect-native discipline** — no async/await, throw/try-catch, new Error(), console.*, let, for/while, switch
- **Tests always use `@effect/vitest`** with `it.effect()` for schema tests
- **Golden test vectors** from RFC 8785, NIST FIPS 180-4, and BLAKE3 reference
- **Schema is the single source of truth** — types are defined as Schema in `src/schemas/`, extracted via `Schema.Type` and `import type`

## Governance

- `internal/*` blocked from consumers via exports map
- No `@noble/hashes` types leak through public surface
- 240 LOC file-size limit applies
