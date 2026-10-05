---
"@scenesystems/digest": patch
---

Reduce canonicalization overhead using Effect's Unicode search, compiled matchers,
mutable cursors, reference-keyed memoization, and one UTF-8 stream per incremental
digest. Emit validated JSON-safe string content directly through Effect string
operations and retain Schema encoding for escaping and numbers. Keep bounded
long-string processing, byte-limit admission, cooperative yields, and reference-only
cycle detection. Add independent full-digest Unicode vectors, escaping boundary
checks, and hostile equality coverage without changing the public API or canonical
bytes.

Reject all typed-array views and DataView, including empty views, rather than
canonicalizing non-Uint8Array views as records. Use an owner-approved intrinsic
view predicate through Schema because Effect 4.0.0 has no public equivalent.
