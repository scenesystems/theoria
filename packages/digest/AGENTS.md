---
description: Development guidelines for @scenesystems/digest
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/digest

Strict canonical JSON, content identities, hashing, MACs, and KDFs for Effect programs.

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

## Public concerns

The root exports namespace objects, and each namespace has an exact matching subpath:

- `Digest` / `@scenesystems/digest/Digest` — algorithm schema plus raw byte, strict text, and stream hashing
- `ContentDigest` / `@scenesystems/digest/ContentDigest` — canonical digest model and unknown/Schema pipelines
- `CanonicalJson` / `@scenesystems/digest/CanonicalJson` — strict RFC 8785 text and bytes
- `Utf8` / `@scenesystems/digest/Utf8` — strict encoding and Unicode scalar construction
- `Blake3`, `Hmac`, and `Hkdf` with matching subpaths — keyed primitives

Keep APIs under their semantic owner. Do not add a flat alias, compatibility wrapper, encoded-format convenience, mutable algorithm registry, crypto provider service, or deep public path. Applications compose hexadecimal and base64 encodings with Effect's `Encoding` module.

Use the least powerful result channel that describes the operation:

- deterministic byte primitives are pure (`Digest.hash`, `Hmac.sha256`, `Hmac.sha1`)
- local validation uses `Either` (`Utf8.encode`, `Utf8.fromScalar`, `Digest.hashString`, `Blake3.mac`, `Blake3.deriveKey`, HKDF)
- cooperative traversal, streams, and Schema encoding use `Effect`

`ContentDigest.ContentDigest` is the runtime and encoded model. Convert it to the `<algorithm>:<base64url>` protocol string only at the boundary with `ContentDigest.toString`.

## Canonicalization law

- Admit `null`, booleans, finite numbers, well-formed Unicode strings, dense array elements, and record values traversed through their own enumerable string keys. Sort record keys by UTF-16 code unit order. Ignore inherited, non-enumerable, and symbol-keyed record fields and non-element array properties.
- Use JSON-visible property and element reads. Do not inspect descriptors or prototypes. The caller must keep the input graph stable until the operation completes.
- Keep traversal state invocation-local and publish no partial output after interruption.
- Validate strings and keys before encoding. Preserve valid text exactly; never normalize or replace malformed text.
- Reject unsupported runtime values, malformed Unicode, and cycles through `CanonicalJson.Error`. Keep diagnostics bounded and free of rejected text, keys, paths, and preimages.
- Keep traversal deterministic, stack-safe, and cooperative between bounded batches. Record key collection and sorting, synchronous Schema transforms, final joining, and final UTF-8 materialization remain synchronous work.
- Delegate Schema encoding to `Schema.encode` or `Schema.encodeEither`; never interpret Schema ASTs here.
- For bounded Schema digests, count serializer-emitted UTF-8 segments and reject the first segment that would exceed the inclusive limit. Do not claim to inspect exactly `maximumBytes + 1` bytes.
- Preserve upstream `E` and `R` in stream APIs. Text stream failures report partition-independent absolute UTF-16 code-unit indices.

## Effect and test discipline

- Public errors and encoded values are Schema-owned. `Digest.Algorithm` owns the hash algorithm type.
- Private traversal variants use `Data.TaggedEnum`; they have no serialization contract. This corrects the former blanket ban on that Effect abstraction.
- Use `@effect/vitest`, `it.effect`, and `Effect.exit`; do not use `Effect.run*` in source or tests.
- Tests import only the root or supported subpaths. Test behavior, known answers, interruption, service requirements, and typed failures—not export inventories or implementation files.
- Delete tests that would only retest Effect's encoding helpers. Wire encodings belong to Effect.
- Keep independent vectors under `test/fixtures/external/`; never derive expected vectors from this package or Noble during test execution.
- `test/fixtures/external/sources.manifest.json` remains the source of truth for provenance, revisions, licenses, transformations, exclusions, verdict mappings, and local hashes.

`src/internal/*` is private and must remain unreachable from package exports.
