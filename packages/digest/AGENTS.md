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

## Architecture: Dual-Layer Package

Two entrypoints, two dependency profiles:

| Entrypoint | Import path                   | Runtime deps    | Effect required? |
| ---------- | ----------------------------- | --------------- | ---------------- |
| Core (`.`) | `@scenesystems/digest`        | `@noble/hashes` | No               |
| Schema     | `@scenesystems/digest/schema` | `@noble/hashes` | Yes (peer)       |

### Core Layer (`src/index.ts`)

Pure JS/TS functions. Zero Effect dependency. Consumers who only need
hashing and canonicalization use this entrypoint.

- `src/algorithms/blake3.ts` — BLAKE3-256 digest
- `src/algorithms/sha256.ts` — SHA-256 digest
- `src/canonicalize.ts` — RFC 8785 JCS canonicalization
- `src/encoding.ts` — base64url encode/decode
- `src/digest.ts` — unified canonicalize → hash → encode pipeline
- `src/contracts.ts` — pure type contracts (DigestAlgorithm, etc.)

### Schema Layer (`src/schema.ts`)

Effect Schema integration. Requires `effect` peer dependency.

- `src/schema/DigestAlgorithm.ts` — `Schema.Literal("blake3-256", "sha256")`
- `src/schema/Digest256.ts` — branded 43-char base64url schema
- `src/schema/ContentDigest.ts` — algorithm-tagged digest pair
- `src/schema/durableFingerprint.ts` — Effect-wrapped canonical fingerprinting
- `src/schema/errors.ts` — `Schema.TaggedError` types

### Internal (`src/internal/`)

Private implementation. Blocked from consumers via exports map.

- `src/internal/bytes.ts` — UTF-8 encoding, buffer ops
- `src/internal/jcs.ts` — recursive JCS engine
- `src/internal/validation.ts` — input guards

## Conventions

- **Effect-native discipline** applies to the schema layer and all tests
- **Core layer is vanilla TS** — no Effect imports in `src/algorithms/`, `src/canonicalize.ts`, `src/encoding.ts`, `src/digest.ts`, `src/contracts.ts`
- **Tests always use `@effect/vitest`** with `it.effect()` for schema-layer tests
- **Golden test vectors** from RFC 8785, NIST FIPS 180-4, and BLAKE3 reference
- **Single source of truth** — algorithms and contracts defined once, consumed by both layers

## Governance

- `internal/*` blocked from consumers via exports map
- Core entrypoint must have zero Effect imports (verified by governance test)
- No `@noble/hashes` types leak through public surface
- 240 LOC file-size limit applies
