---
"@scenesystems/digest": minor
"@scenesystems/effect-search": minor
---

Redesign digest as Effect-native concern modules with root namespaces and matching
`Blake3`, `CanonicalJson`, `ContentDigest`, `Digest`, `Hkdf`, `Hmac`, and `Utf8`
subpaths. This is a breaking pre-1.0 API release; the old flat exports are removed.

Raw hashes and HMACs are pure. Strict text and keyed primitives return `Either`
for expected validation failures, including invalid derivation lengths. Streams
and cooperative canonical/Schema hashing retain Effect failures, requirements,
and interruption. Compose wire encodings with Effect's `Encoding` module.

Structured hashing now returns the canonical `ContentDigest.ContentDigest` model;
use `ContentDigest.toString` for the unchanged tagged string representation.
Digest values reject noncanonical base64url pad bits. Migrate consumers to the
owning concern modules; there are no compatibility aliases. Effect-search imports
the canonical identity model and preserves its cache fingerprint wire format.
