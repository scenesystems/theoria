---
"@scenesystems/seal": minor
---

Replace flat encryption exports with `Cipher` and `Envelope` namespaces and matching public subpaths. This is a breaking pre-1.0 API migration; no legacy aliases remain.

Use `Cipher.encrypt` / `Cipher.decrypt` for nonce-prefixed bytes and `Envelope.encrypt` / `Envelope.decrypt` for JSON envelopes. Provide `Cipher.layer` at the host boundary. Replace `SealedEnvelope` with `Envelope.Envelope`, `SealAlgorithm` with `Cipher.Algorithm`, and root error imports with `Cipher.InvalidKey` / `Cipher.DecryptionFailed`. `Cipher.generateKey` is now an effect that always produces a 32-byte key. Use platform text codecs instead of the removed UTF-8 wrappers, and a byte-comparison library instead of `equalBytes`.

`Envelope.fromBytes` replaces `packEnvelope` as a pure conversion; `Envelope.toBytes` replaces `unpackEnvelope` with an `Either` whose failures are `DecryptionFailed`. Validate the nonce and ciphertext field lengths separately, rejecting byte shifts across their boundary. Key/nonce entropy failures are now typed `KeyGenerationFailed` / `EncryptionFailed` failures rather than defects.

Valid ciphertext layouts, JSON envelope fields, algorithm identifiers, and existing error tags remain unchanged. No data migration is needed for valid stored envelopes. Add independent Wycheproof/RFC known-answer vectors and property-based composition coverage.
