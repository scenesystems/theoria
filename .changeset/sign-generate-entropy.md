---
"@scenesystems/sign": minor
---

Add `generateEntropy(length = 32)`, an Effect-native CSPRNG source for the 32 entropy bytes that `mlDsa65SignHedged` requires, the `HEDGED_SIGNING_ENTROPY_BYTES` constant, and `EntropyGenerationFailed`, the typed error it fails with when the runtime has no `crypto.getRandomValues` or the requested length is not a safe non-negative integer within the platform's per-call limit. The post-quantum example uses it instead of calling `crypto.getRandomValues` directly.

ML-DSA-65 verification rejects a signature whose hint endpoint block is truncated. Previously a signature carrying fewer than the six endpoint bytes passed the strict hint-encoding check and reached the primitive.
