---
"@scenesystems/digest": minor
---

Add canonical JSON digest helper APIs for one-call RFC 8785 JCS + hash workflows.

New exports include `digestCanonicalJsonBytes`, `digestCanonicalJsonBase64Url`, and `digestCanonicalJsonHex`, which preserve canonicalization error semantics while removing repeated `canonicalize + utf8ToBytes + digest` boilerplate.
