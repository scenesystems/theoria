---
description: Development guidelines for @scenesystems/digest
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/digest

Strict canonicalization and cryptographic digest primitives for Effect.

## Required checks

| Task                               | Command                   |
| ---------------------------------- | ------------------------- |
| Source typecheck                   | `bun run check`           |
| Test typecheck                     | `bun run check:tests`     |
| Example typecheck                  | `bun run check:examples`  |
| Lint                               | `bun run lint`            |
| Behavioral and conformance tests   | `bun run test`            |
| Fixture provenance and conformance | `bun run fixtures:verify` |
| Build                              | `bun run build`           |

Use the smallest targeted check while developing, then run every relevant package and workspace gate before committing. Tests must prove behavior. Do not add tests or harnesses that inspect package assets, source inventories, export maps, or generated distribution layout.

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
- `src/internal/jcs-machine.ts` owns invocation-local traversal state and the cooperative and synchronous drivers.
- `src/internal/jcs-model.ts` defines serializer frames, buffered segments, and redacted failure state.
- `src/internal/jcs-serialization-machine.ts` serializes through Effect's public collection, `Record`, `Schema`, and ordering APIs.

Do not create a descriptor/prototype admission layer, bespoke Schema AST interpreter, second canonicalization law, text encoder, public subpath, mutable algorithm registry, injectable crypto provider, or owner-specific identity policy here.

## Canonicalization law

- Admit `null`, booleans, finite numbers, well-formed Unicode strings, dense array elements, and record values traversed through their own enumerable string keys. Sort record keys by UTF-16 code unit order. Ignore inherited, non-enumerable, and symbol-keyed record fields and non-element array properties.
- Use JSON-visible property and element reads. Do not inspect descriptors or prototypes and do not impose a hostile-object or reflection contract. The caller must keep the input graph stable until the operation completes.
- Keep mutable traversal state and package-owned traversal references invocation-local, and publish no partial output after interruption. This non-retention law does not promise that an Effect value retained by its caller forgets the input captured by its closure.
- Validate strings and keys before encoding. Preserve valid text exactly; never normalize or replace malformed text.
- Reject unsupported runtime values, malformed Unicode, and cycles through the closed `CanonicalizationError` union. Callers must use their actual `Schema` encoder to convert non-JSON runtime data to the intended encoded representation.
- Keep errors bounded and deterministic: no rejected text, keys, paths, or preimages.
- Keep canonical traversal deterministic, stack-safe, and cooperative between bounded traversal batches. `Record.keys` and key sorting, native synchronous Schema transforms, final string joining, and final UTF-8 materialization remain synchronous work and are not bounded interruption points.
- Delegate Schema-aware encoding to public `Schema.encode` or `Schema.encodeEither`; Schema owns transforms and encoded forms. Never interpret Schema ASTs in this package.
- For bounded Schema digests, count serializer-emitted UTF-8 segments and reject the first segment that would exceed the inclusive limit. Stop before producing the complete oversized output; do not claim to inspect exactly `maximumBytes + 1` bytes.
- Preserve upstream `E` and `R` in stream APIs. Text stream failures report partition-independent absolute UTF-16 code-unit indices.

## Effect and test discipline

- Model expected fallibility with `Effect`; use `Schema.TaggedError` for closed public errors and `Match.exhaustive` for fixed algorithm dispatch.
- Do not use `Effect.run*` in source or tests. Use `@effect/vitest`, `it.effect`, and `Effect.exit` for failure assertions.
- Test observable laws and exact failure values. Property tests supplement independent known-answer vectors; provider round trips are not conformance evidence.
- Never expose Noble-specific types from the public API.

## Fixture governance

All repository fixture tooling is implemented in TypeScript and Effect. Do not introduce external runtime generators or another implementation language into the digest workflow.

Keep independent upstream vectors under `test/fixtures/external/`. Never derive expected cryptographic or canonicalization outputs from this package or Noble during test execution. `test/fixtures/external/sources.manifest.json` is the canonical record for source revision, license, transformation, exclusion, verdict mapping, and local content hash.
