---
"@scenesystems/sign": minor
---

`sign` accepts a `KeyOnlySigningAlgorithm`, the new `SignatureAlgorithm` subset whose signing profile is complete with a key pair alone. `"ml-dsa-65"` is excluded at the type level: its signing needs caller-supplied entropy and a FIPS 204 context, so use `mlDsa65SignHedged` (production) or `mlDsa65SignDeterministic` (conformance) directly. The deprecated always-failing `mlDsa65Sign` entrypoint is removed. `verify` is unchanged and still checks every `SignatureAlgorithm`, including ML-DSA-65 with the empty context.
