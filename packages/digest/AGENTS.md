---
description: Development guidelines for @scenesystems/digest
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/digest

Strict canonicalization and cryptographic digest primitives for Effect.

## Required checks

| Task                               | Command                                           |
| ---------------------------------- | ------------------------------------------------- |
| Source typecheck                   | `bun run check`                                   |
| Test typecheck                     | `bun run check:tests`                             |
| Example typecheck                  | `bun run check:examples`                          |
| Lint                               | `bun run lint`                                    |
| Behavioral and conformance tests   | `bun run test`                                    |
| Fixture governance and conformance | `bun run fixtures:verify`                         |
| Build                              | `bun run build`                                   |
| Packed release evidence            | `bun run publish:check --require-packed-manifest` |

Use the smallest targeted check while developing, then run every relevant package and workspace gate before committing. Tests must prove behavior. Enforce documentation, manifest, export, and release metadata with dedicated build or publish checks rather than test assertions about files or identifiers existing.

## Architecture

The package has one public entrypoint, `@scenesystems/digest`. Effect is a required peer dependency. Public errors and branded values are Schema-owned. Noble Hashes provides the cryptographic kernels and remains private behind package-owned Effects.

### Public modules

- `src/algorithms/blake3.ts` — BLAKE3 hash, keyed MAC, and context KDF
- `src/algorithms/sha256.ts` — SHA-256 digest
- `src/canonicalize.ts` — strict, stack-safe RFC 8785 JCS canonicalization
- `src/encoding.ts` — strict UTF-8 plus base64url and hex encoding/decoding
- `src/digest.ts` — canonicalize → UTF-8 → hash → base64url → algorithm tag
- `src/convenience.ts` — byte, text, and canonical JSON digest helpers
- `src/digestSchemaValue.ts` — Schema encode → canonical digest pipeline with `R` preservation
- `src/streaming.ts` — incremental byte and strict text digest pipelines
- `src/hmac.ts` — HMAC-SHA256 and HMAC-SHA1
- `src/kdf.ts` — RFC 5869 HKDF-SHA256 and HKDF-SHA512
- `src/schemas/` — digest schemas, closed errors, and durable fingerprinting

### Private implementation

`src/internal/*` is blocked by the exports map.

- `src/internal/unicode.ts` is the only Unicode scalar-well-formedness and unchecked UTF-8 kernel.
- `src/internal/admission.ts` snapshots and admits the strict plain-data canonical domain without evaluating getters.
- `src/internal/jcs.ts` serializes with an explicit stack-safe state machine.

Do not create a second canonicalization law, text encoder, public subpath, mutable algorithm registry, injectable crypto provider, or owner-specific identity policy here.

## Canonicalization law

- Admit only `null`, booleans, finite numbers, well-formed Unicode strings, dense arrays, and plain records with `Object.prototype` or `null` prototype and own enumerable string-keyed data properties.
- Validate strings and keys before encoding. Preserve valid text exactly; never normalize or replace malformed text.
- Reject unsupported values, hostile descriptors/reflection, and cycles through the closed `CanonicalizationError` union.
- Keep errors bounded and deterministic: no rejected text, keys, paths, or preimages.
- Keep one-shot traversal deterministic and stack-safe. Do not inject scheduling behavior; workload bounds belong to consumers before the call.
- Preserve upstream `E` and `R` in stream APIs. Text stream failures report partition-independent absolute UTF-16 code-unit indices.

## Effect and test discipline

- Model expected fallibility with `Effect`; use `Schema.TaggedError` for closed public errors and `Match.exhaustive` for fixed algorithm dispatch.
- Do not use `Effect.run*` in source or tests. Use `@effect/vitest`, `it.effect`, and `Effect.exit` for failure assertions.
- Test observable laws and exact failure values. Property tests supplement independent known-answer vectors; provider round trips are not conformance evidence.
- Keep production files within the repository's 240-line limit.
- Never expose Noble-specific types from the public API.

## Fixture governance

All repository fixture tooling is implemented in TypeScript and Effect. Do not introduce external runtime generators or another implementation language into the digest workflow.

Keep independent upstream vectors under `test/fixtures/external/`. Never derive expected cryptographic or canonicalization outputs from this package or Noble during test execution. `test/fixtures/external/sources.manifest.json` is the canonical record for source revision, license, transformation, exclusion, verdict mapping, and local content hash.
