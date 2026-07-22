---
"@scenesystems/digest": minor
---

Ship strict, stack-safe RFC 8785 canonicalization and one Unicode law across the public digest surface.

- Every public text path rejects malformed UTF-16 with `InvalidUnicode` and preserves well-formed text without normalization or replacement.
- `encodeUtf8` is the sole public string-to-byte operation; direct Effect functions are the complete digest and streaming API.
- Canonicalization admits only finite JSON primitives, dense arrays, and plain data records; unsupported primitives, built-ins, descriptors, prototypes, reflection, and cyclic graphs fail through the closed `CanonicalizationError` Schema union.
- Canonicalization diagnostics are bounded structural data and never contain rejected text, keys, paths, or preimages.
- `canonicalJsonBytes`, canonical digest helpers, durable fingerprints, and Schema-aware digests share the same strict, stack-safe canonicalization kernel.
- Byte streams preserve upstream errors unchanged. Text streams preserve valid surrogate pairs split across chunks and report malformed text with partition-independent absolute UTF-16 code-unit indices.
- Repository fixture governance is TypeScript- and Effect-native, while cryptographic and JCS expectations remain independently sourced from pinned upstream standards corpora.
