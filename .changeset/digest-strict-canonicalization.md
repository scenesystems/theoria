---
"@scenesystems/digest": minor
---

Make canonicalization and every public text path Unicode-strict with closed, Schema-owned errors.

- Replace `utf8ToBytes` with the effectful `encodeUtf8`, remove `DigestStreaming` and `DigestStreamingLive` in favor of the existing `digestByteStream*` and strict `digestUtf8Stream*` functions, and replace `FingerprintUnsupportedValue` with `CanonicalizationError`.
- Add `InvalidUnicode`, `UnsupportedValue`, `CyclicValue`, and the `CanonicalizationError` Schema/type union.
- Reject malformed UTF-16 rather than silently replacing unpaired surrogates, including in BLAKE3 contexts, canonical JSON, digest convenience functions, and UTF-8 streams.
- Reject non-plain canonical inputs including unsupported primitives and built-ins, accessors, symbol or non-enumerable properties, sparse or augmented arrays, unsupported prototypes, reflection failures, and cyclic graphs.
- Add `InvalidUnicode` to text-stream error channels while preserving upstream stream failures and reporting partition-independent absolute UTF-16 code-unit indices.
