---
"@scenesystems/sign": patch
---

Update `@noble/curves` and `@noble/hashes` to 2.4.0 and `@noble/post-quantum` to 0.7.1. The hybrid KEM now imports `ml_kem768_x25519`, the name `@noble/post-quantum` 0.7 gives its X-Wing implementation (ML-KEM-768 + X25519); the algorithm, key, ciphertext, and shared-secret formats are unchanged.
