# @scenesystems/sign

## 0.4.0

### Minor Changes

- [#104](https://github.com/scenesystems/theoria/pull/104) [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add `Ed25519Seed` and `ed25519KeyPairFromSeed` to reconstruct an RFC 8032 identity from exactly 32 seed bytes without entropy. Validate and copy the seed on execution; returned keys do not alias the input, and typed failures retain no key material.

  **Behavior change:** `ed25519Sign` now rejects a supplied public key that does not match the secret seed. Random key generation uses the same reconstruction operation through the package entropy API.

- [#104](https://github.com/scenesystems/theoria/pull/104) [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add `rsaPublicKeyFromJwk` and `rsaSha256Verify` for canonical public JWK import and RSASSA-PKCS1-v1_5 SHA-256 verification. Support 2048–4096-bit moduli, odd public exponents from 3 through 2³²−1, and messages up to 8192 bytes. Invalid input and backend unavailability have distinct, material-free failures; an admitted nonmatch returns `false`.

  Add `Jwt.verifyRs256` with unique key selection, explicit issuer/audience/lifetime policy, and Effect Clock validation. Issuance and not-before are inclusive; expiry is exclusive, with no clock skew. Application claim Schemas run after authentication and preserve requirements and interruption. Callers own JWKS trust and authorization policy; retain integer Schema refinements when fractional NumericDates are not permitted.

  Add independent Wycheproof and OpenSSL coverage, including signed Access-policy fixtures, and exercise the packed RSA/JWT APIs in Bun and workerd without Node compatibility. Local workerd CPU measurements are not production budget guarantees. The new RSA composition uses existing public Noble primitives but is not covered by Noble's dependency audits; no production RSA signer is added.

## 0.3.0

### Minor Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add `generateEntropy(length = 32)`, an Effect-native CSPRNG source for the 32 entropy bytes that `mlDsa65SignHedged` requires, the `HEDGED_SIGNING_ENTROPY_BYTES` constant, and `EntropyGenerationFailed`, the typed error it fails with when the runtime has no `crypto.getRandomValues` or the requested length is not a safe non-negative integer within the platform's per-call limit. The post-quantum example uses it instead of calling `crypto.getRandomValues` directly.

  ML-DSA-65 verification rejects a signature whose hint endpoint block is truncated. Previously a signature carrying fewer than the six endpoint bytes passed the strict hint-encoding check and reached the primitive.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - `sign` accepts a `KeyOnlySigningAlgorithm`, the new `SignatureAlgorithm` subset whose signing profile is complete with a key pair alone. `"ml-dsa-65"` is excluded at the type level: its signing needs caller-supplied entropy and a FIPS 204 context, so use `mlDsa65SignHedged` (production) or `mlDsa65SignDeterministic` (conformance) directly. The deprecated always-failing `mlDsa65Sign` entrypoint is removed. `verify` is unchanged and still checks every `SignatureAlgorithm`, including ML-DSA-65 with the empty context.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - The per-algorithm key generators (`ed25519Keygen`, `secp256k1EcdsaKeygen`, `secp256k1SchnorrKeygen`, `x25519Keygen`, `xwingKeygen`, `mlDsa44Keygen`, `mlDsa65Keygen`, `mlDsa87Keygen`, `slhDsaSha2128fKeygen`, `slhDsaSha2128sKeygen`, `slhDsaSha2192fKeygen`, `slhDsaSha2256fKeygen`) now fail with `KeyGenerationFailed` when the underlying Noble primitive throws, such as in a runtime without `crypto.getRandomValues`, instead of dying. `generateKeyPair` already declared that error and now propagates it from the selected primitive rather than through a catch-all that could never run.

### Patch Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Update `@noble/curves` and `@noble/hashes` to 2.4.0 and `@noble/post-quantum` to 0.7.1. The hybrid KEM now imports `ml_kem768_x25519`, the name `@noble/post-quantum` 0.7 gives its X-Wing implementation (ML-KEM-768 + X25519); the algorithm, key, ciphertext, and shared-secret formats are unchanged.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - `mlDsa65SignHedged` admits and copies its inputs when the Effect executes. An input that cannot be read — a detached `ArrayBuffer`, a proxy that raises on property access — fails with `SigningFailed` (`reason: "invalid input"`) instead of throwing while the Effect is being constructed, matching the direct verification functions.

## 0.2.2

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - The build no longer writes `dist/verifier-descriptor.json`; the release-descriptor scripts that produced it were removed together with the release-snapshot governance. The published code is unchanged.

## 0.2.1

### Patch Changes

- [#68](https://github.com/scenesystems/theoria/pull/68) [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Publish the rewritten package README with a clearer account of the package's purpose, use, and place in Theoria.

## 0.2.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

## 0.1.1

### Patch Changes

- [#40](https://github.com/scenesystems/theoria/pull/40) [`64acbc8`](https://github.com/scenesystems/theoria/commit/64acbc8b6f1780fcd426afced3daa4a07d8d4188) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Make direct verification admission and input detachment lazy, and classify detached or uncopyable typed-array input as `InvalidVerificationInput`.

- [#38](https://github.com/scenesystems/theoria/pull/38) [`ac6ec9a`](https://github.com/scenesystems/theoria/commit/ac6ec9a03cda0fffb220f7f4b2347c2806094f74) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add strict detached Ed25519, P-256 SHA-256 P1363 low-S, and ML-DSA-65 verification profiles with material-free typed errors and explicit ML-DSA context and hedged entropy.

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `@scenesystems/sign` — digital signatures, key agreement, and key encapsulation for Effect.

  ### Signature algorithms
  - **Ed25519** — EdDSA signatures (RFC 8032) with 32-byte keys and 64-byte signatures
  - **secp256k1 ECDSA** — Ethereum/Bitcoin-compatible ECDSA signatures
  - **secp256k1 Schnorr** — BIP-340 Schnorr signatures for Bitcoin Taproot
  - **ML-DSA-44/65/87** — FIPS-204 (Dilithium) post-quantum lattice-based signatures at three security levels
  - **SLH-DSA-SHA2-128f/128s/192f/256f** — FIPS-205 (SPHINCS+) hash-based post-quantum signatures

  ### Key agreement
  - **X25519** — RFC 7748 elliptic-curve Diffie–Hellman for deriving shared secrets between two parties

  ### Key encapsulation
  - **XWing** — hybrid KEM combining X25519 and ML-KEM-768 for quantum-resistant key transport

  ### Signing pipeline
  - **`sign`** — sign a message with algorithm selection, producing a self-describing `Signature` carrying algorithm tag and public key
  - **`verify`** — verify a signature using the algorithm recorded in the signature object
  - **`generateKeyPair`** — generate key pairs for any algorithm across all three cryptographic families
  - **`deriveSharedSecret`** — X25519 key agreement producing a `SharedSecret`
  - **`encapsulate`** / **`decapsulate`** — XWing hybrid KEM for quantum-resistant key exchange

  ### Schema types
  - **`Signature`** — `Schema.Class` with algorithm, signature bytes, and public key
  - **`KeyPair`** — `Schema.Class` with algorithm, public key, and secret key
  - **`SharedSecret`** — `Schema.Class` for key agreement output
  - **`KemCiphertext`** — `Schema.Class` for KEM encapsulation output
  - **`SignatureAlgorithm`** / **`AgreementAlgorithm`** / **`KemAlgorithm`** — literal unions enforcing family separation
  - **`SigningFailed`** / **`VerificationFailed`** / **`InvalidSignature`** / **`KeyGenerationFailed`** — `Schema.TaggedError` types

  ### Utilities
  - **`utf8ToBytes`** — UTF-8 encoding without reaching into Noble directly
  - **`toHex`** — hex encoding for key and signature display
  - **`equalBytes`** — constant-time byte comparison preventing timing side-channel attacks

  All cryptographic primitives are built on the [Noble](https://paulmillr.com/noble/) audited ecosystem (`@noble/curves`, `@noble/hashes`, `@noble/post-quantum`). Every operation is Effect-native with typed error channels.
