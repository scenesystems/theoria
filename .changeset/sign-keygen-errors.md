---
"@scenesystems/sign": minor
---

The per-algorithm key generators (`ed25519Keygen`, `secp256k1EcdsaKeygen`, `secp256k1SchnorrKeygen`, `x25519Keygen`, `xwingKeygen`, `mlDsa44Keygen`, `mlDsa65Keygen`, `mlDsa87Keygen`, `slhDsaSha2128fKeygen`, `slhDsaSha2128sKeygen`, `slhDsaSha2192fKeygen`, `slhDsaSha2256fKeygen`) now fail with `KeyGenerationFailed` when the underlying Noble primitive throws, such as in a runtime without `crypto.getRandomValues`, instead of dying. `generateKeyPair` already declared that error and now propagates it from the selected primitive rather than through a catch-all that could never run.
