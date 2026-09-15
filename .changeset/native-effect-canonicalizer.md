---
"@scenesystems/digest": minor
---

Replace reflection-based admission and the bespoke Schema AST interpreter with native Effect traversal and public Schema encoding.

- **Breaking (0.x):** canonicalization reads dense array elements and own enumerable string-keyed record fields normally. It omits inherited, non-enumerable, and symbol-keyed record fields and extra array properties instead of rejecting them. Descriptor/prototype checks and their `UnsupportedValue` reasons are removed. Supply a stable input graph; use the caller's Schema to encode non-JSON runtime values.
- Track ancestors by reference identity, keeping deep Data values and Schema classes stack-safe while rejecting cycles and malformed Unicode with redacted errors.
- Encode each Schema value once with `Schema.encode` or `Schema.encodeEither`, preserving the encoder's requirements and semantics.
- Bounded digests reject the first emitted UTF-8 segment exceeding the inclusive byte limit, before completing oversized output. They no longer promise to stop at exactly `maximumBytes + 1` bytes. Traversal yields between batches; Schema transforms, key enumeration/sorting, final joining, and UTF-8 materialization remain synchronous boundaries.
