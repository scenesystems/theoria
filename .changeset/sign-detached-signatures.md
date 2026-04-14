---
"@scenesystems/sign": minor
---

Add a detached-signature workflow to `@scenesystems/sign`.

This makes it easier to sign content that travels separately from its proof, verify it with explicit keys, and batch-check many signatures in one pass while preserving clear per-item results. It also improves the package’s portable transport story with safer text codecs for keys, signatures, shared secrets, and KEM ciphertexts.

The release rounds that out with clearer algorithm guidance, examples, and vector-backed correctness coverage so detached signatures feel like a complete supported path rather than a low-level add-on.
