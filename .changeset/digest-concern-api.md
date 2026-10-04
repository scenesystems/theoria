---
"@scenesystems/digest": minor
"@scenesystems/effect-search": minor
---

Redesign digest as Effect-native concern modules with root namespaces and matching
`Blake3`, `CanonicalJson`, `ContentDigest`, `Digest`, `Hkdf`, `Hmac`, and `Utf8`
subpaths. This is a breaking pre-1.0 API release; the old flat exports are removed.

Require Effect v4. Raw hashes, strict text and canonical JSON, HMACs, HKDF, and
BLAKE3 keyed primitives are lazy Effects with typed validation failures, including
invalid derivation lengths. Streams
and cooperative canonical/Schema hashing retain Effect failures, requirements,
and interruption. Compose wire encodings with `effect/encoding`.

UTF-8 uses Effect's stream encoder rather than base64 intermediates. Canonical
hashing drains encoded segments between traversal batches without collecting the
whole preimage. Remove `ContentDigest.fromSchemaWithByteLimitResult`; use the
effectful bounded API without a synchronous compatibility wrapper.

Structured hashing now returns the canonical `ContentDigest.ContentDigest` model;
use `ContentDigest.toString` for the unchanged tagged string representation.
Digest values reject noncanonical base64url pad bits. Migrate consumers to the
owning concern modules; there are no compatibility aliases. Effect-search imports
the canonical identity model and preserves its cache fingerprint wire format.

`ContentDigest.fromBytes`, `fromUnknown`, `fromSchema`, and
`fromSchemaWithByteLimit` are effectful. Schema-based hashing preserves encoding
services, failures, interruption, and per-execution hasher finalization; provide
the schema's encoding requirements at the call site.
