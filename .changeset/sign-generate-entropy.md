---
"@scenesystems/sign": patch
---

Add `generateEntropy(length = 32)`, an Effect-native CSPRNG source for the 32 entropy bytes that `mlDsa65SignHedged` requires, and the `HEDGED_SIGNING_ENTROPY_BYTES` constant. The post-quantum example uses it instead of calling `crypto.getRandomValues` directly.
