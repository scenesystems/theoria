---
"@scenesystems/sign": minor
---

Add `Ed25519Seed` and `ed25519KeyPairFromSeed` to reconstruct an RFC 8032 identity from exactly 32 seed bytes without entropy. Validate and copy the seed on execution; returned keys do not alias the input, and typed failures retain no key material.

**Behavior change:** `ed25519Sign` now rejects a supplied public key that does not match the secret seed. Random key generation uses the same reconstruction operation through the package entropy API.
