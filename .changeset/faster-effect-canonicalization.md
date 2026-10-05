---
"@scenesystems/digest": patch
---

Reduce canonicalization overhead using Effect's Unicode search, compiled matchers,
Schema string encoding, and one UTF-8 stream per incremental digest. Keep bounded
long-string processing, byte-limit admission, cooperative yields, and reference-only
cycle detection. Add independent full-digest Unicode vectors and hostile equality
coverage without changing the public API or canonical bytes.
