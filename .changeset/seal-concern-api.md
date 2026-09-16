---
"@scenesystems/seal": minor
---

Replace flat encryption exports with `Cipher` and `Envelope` namespaces and matching public subpaths. This is a breaking pre-1.0 API migration; no legacy aliases remain.

Use `Cipher.encrypt` / `Cipher.decrypt` for nonce-prefixed bytes and `Envelope.encrypt` / `Envelope.decrypt` for JSON envelopes. Provide `Cipher.layer` at the host boundary. Replace `SealedEnvelope` with `Envelope.Envelope`, `SealAlgorithm` with `Cipher.Algorithm`, and root error imports with `Cipher.InvalidKey` / `Cipher.DecryptionFailed`. `Cipher.generateKey` is now an effect that always produces a 32-byte key. Use Effect's `Stream.encodeText` / `Stream.decodeText` instead of the removed UTF-8 wrappers. `Schema.equivalence(Schema.Uint8ArrayFromSelf)` compares public bytes; it is not a constant-time secret-comparison API.

Replace `unseal(key, envelope)` with receiver-first `Envelope.decrypt(envelope, key)`, or compose with `Effect.flatMap(Envelope.decrypt(key))`.

`Envelope.fromBytes` replaces `packEnvelope` as a pure conversion; `Envelope.toBytes` replaces `unpackEnvelope` with an `Either` whose failures are `DecryptionFailed`. Validate the nonce and ciphertext field lengths separately, rejecting byte shifts across their boundary. Key/nonce entropy failures are now typed `KeyGenerationFailed` / `EncryptionFailed` failures rather than defects.

All Cipher failures use `Data.TaggedError`; `InvalidKey` and `DecryptionFailed` are no longer Schema codecs. Protocols own their outward error representation. Byte conversions, validation, and private entropy sequencing consume public Effect APIs. Behavioral coverage includes lazy acquisition, validation order, nonce-length rejection, and cancellation/finalization.

Valid ciphertext layouts, JSON envelope fields, algorithm identifiers, and existing error tags remain unchanged. No data migration is needed for valid stored envelopes. Add independent Wycheproof/RFC known-answer vectors and property-based composition coverage.
