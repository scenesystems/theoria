---
"@scenesystems/digest": minor
"@scenesystems/effect-dsp": minor
"@scenesystems/effect-search": patch
---

Reduce canonicalization overhead using Effect's Unicode search, compiled matchers,
mutable cursors, reference-keyed memoization, and one UTF-8 stream per incremental
digest. Emit validated JSON-safe string content directly through Effect string
operations and retain Schema encoding for escaping and numbers. Keep bounded
long-string processing, byte-limit admission, cooperative yields, and reference-only
cycle detection. Add independent full-digest Unicode vectors, escaping boundary
checks, and hostile equality coverage without changing canonical bytes for unchanged
wire representations.

Reduce cold traversal allocation by retaining collection cursors in Effect mutable
lists and caching at most 128 validated short keys per invocation. Use direct public
Effect imports, string reducers, and a Schema boolean compiler operation for view
classification, without dynamic code generation or changing caller codecs.

Separate bounded traversal yields from output flushing, consume encoded batches
through Effect's chunk consumer, and align ASCII-only output before UTF-8 encoding.
Reuse identical own-key ordering, close exhausted cursors without another frame,
and count validated UTF-8 widths with Effect string operations. Preserve exact
inclusive limits, final output tails, and malformed-Unicode diagnostics.

Breaking pre-1.0 change: remove ContentDigest.fromUnknown. Structured identities
require an owner-selected codec through fromSchema or fromSchemaWithByteLimit;
fromBytes remains the explicit byte-identity boundary. DSP cache Request and
KeyRequest require inputSchema and paramsSchema. Search caches use their existing
key codecs. Do not substitute Schema.Unknown during migration: choose identity
fields and transformations explicitly, and version changed domain representations.

Reject all typed-array views and DataView, including empty views, rather than
canonicalizing non-Uint8Array views as records. Use an owner-approved intrinsic
view predicate through Schema because Effect 4.0.0 has no public equivalent.
