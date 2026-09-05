# @scenesystems/sign

`@scenesystems/sign` provides digital signatures, X25519 key agreement, and XWing hybrid key encapsulation for programs built with [Effect](https://effect.website). Use it when a message must be attributable to the holder of a key, when two parties need a shared secret, or when a protocol must stay secure against a future quantum adversary.

The three families are kept apart because their security roles differ. Signatures prove possession of a signing key under an identity policy you define. Agreement and encapsulation produce raw shared secret material that must pass through a key derivation function before it becomes a key. Each family has its own operations and its own tagged result schemas: `Signature`, `SharedSecret`, and `KemCiphertext`, with `KeyPair` shared across all algorithms. Primitive implementations come from the Noble Curves, Hashes, and Post-Quantum projects.

The package does not provide identity, authorization, certificates, trust roots, key storage, rotation, transcript construction, or protocol policy. A KEM is unauthenticated on its own, so a protocol must bind recipient keys and transcripts through an authenticated channel. [`@scenesystems/digest`](../digest/README.md) supplies HKDF and BLAKE3 key derivation for the shared secrets this package produces, and [`@scenesystems/seal`](../seal/README.md) encrypts under the derived keys.

## Installation

```sh
npm install @scenesystems/sign effect
```

Effect `^3.22.1` is a required peer dependency. The package has one entrypoint, `@scenesystems/sign`.

## Basic use

`generateKeyPair` accepts any algorithm from the three families and returns a `KeyPair`. `sign` produces a `Signature` carrier that records the algorithm and public key beside the signature bytes. A direct verifier such as `ed25519Verify` checks detached signature bytes against a public key you supply yourself.

```ts typecheck
import { ed25519Verify, generateKeyPair, sign, utf8ToBytes } from "@scenesystems/sign"
import { Effect } from "effect"

export const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("signed content")
  const signed = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  const valid = yield* ed25519Verify(signed.signature, message, keys.publicKey)
  return { signed, valid }
})
```

Prefer a direct verifier whenever your protocol fixes the algorithm and authenticates the public key independently. The generic `verify(signature, message)` dispatches on the algorithm and public key carried inside the `Signature`, which is only appropriate when that self-describing model is deliberately part of the protocol.

## Supported families

| Family     | Algorithms                                                                                                           | Operations                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Signatures | `ed25519`, `secp256k1-ecdsa`, `secp256k1-schnorr`, `ml-dsa-44`, `ml-dsa-65`, `ml-dsa-87`, four `slh-dsa-sha2-*` sets | `sign`, `verify`, algorithm-specific functions |
| Agreement  | `x25519`                                                                                                             | `deriveSharedSecret`                           |
| KEM        | `xwing` (X25519 with ML-KEM-768)                                                                                     | `encapsulate`, `decapsulate`                   |

The algorithm names are the literal unions `SignatureAlgorithm`, `AgreementAlgorithm`, and `KemAlgorithm`. Every family also exposes algorithm-specific functions, such as `ed25519Sign` and `xwingEncapsulate`, for callers that want the algorithm fixed in the type rather than passed as a value.

Key agreement returns a `SharedSecret` whose 32 raw bytes must be derived before use. The same rule applies to the `sharedSecret` field of a `KemCiphertext`.

```ts typecheck
import { deriveSharedSecret, equalBytes, generateKeyPair } from "@scenesystems/sign"
import { Effect } from "effect"

export const agree = Effect.gen(function* () {
  const alice = yield* generateKeyPair("x25519")
  const bob = yield* generateKeyPair("x25519")
  const fromAlice = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
  const fromBob = yield* deriveSharedSecret("x25519", bob.secretKey, alice.publicKey)
  return equalBytes(fromAlice.sharedSecret, fromBob.sharedSecret)
})
```

## Strict direct verification

`ed25519Verify`, `p256Sha256P1363LowSVerify`, and `mlDsa65Verify` take detached signature bytes, the protected message bytes, and an explicit public key. They never read an algorithm field and never accept or return the `Signature` carrier. Their result contract is strict.

| Input or result                                                       | Effect result              |
| --------------------------------------------------------------------- | -------------------------- |
| Canonical, admitted signature verifies                                | `true`                     |
| Canonical, admitted signature does not verify                         | `false`                    |
| Malformed, noncanonical, wrong-length, or unsupported primitive input | `InvalidVerificationInput` |
| Admitted input reaches an unavailable backend                         | `VerificationUnavailable`  |

Both errors carry no material: no algorithm, key, signature, message, context, provider reason, or underlying exception. Inputs are admitted and copied on every execution of the returned Effect, so a buffer mutated between runs is rejected rather than silently reread. Primitive calls run synchronously and cannot be interrupted.

The profiles are fixed and reject alternate encodings:

- Ed25519 follows RFC 8032 without ZIP-215 leniency. Public keys and the signature `R` point must be canonical, non-small-order encodings, and `S` must be below the subgroup order. Public keys are 32 bytes and signatures 64 bytes.
- P-256 applies SHA-256 exactly once. Public keys must be 65-byte uncompressed SEC1 encodings and signatures 64-byte IEEE P1363 `r || s` with low `S`. DER, compressed keys, and high-`S` signatures are rejected.
- ML-DSA-65 follows FIPS 204 with an explicit context. Public keys are 1,952 bytes and signatures 3,309 bytes with canonical hint encoding. An empty context and a nonempty context define distinct profiles.

Direct verification admits messages up to 8,192 bytes and rejects longer input before the primitive runs. This bound protects the verifier; it is not a wire-format limit, and your protocol must still define its own message-size policy.

## Post-quantum signatures

Production ML-DSA-65 signing uses `mlDsa65SignHedged`, which requires exactly 32 bytes of fresh cryptographic entropy from the caller and an explicit FIPS 204 context of 0 through 255 bytes. Ambient randomness is never consulted, which keeps signing reproducible under test and auditable in production. `mlDsa65SignDeterministic` exists for conformance vectors, and both `mlDsa65Sign` and `sign("ml-dsa-65", ...)` fail with `SigningFailed` because those signatures have nowhere to accept the entropy.

```ts typecheck
import { generateEntropy, generateKeyPair, mlDsa65SignHedged, mlDsa65Verify, utf8ToBytes } from "@scenesystems/sign"
import { Effect } from "effect"

export const signDocument = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ml-dsa-65")
  const message = utf8ToBytes("quantum-resistant document")
  const context = utf8ToBytes("example.com/documents/v1")
  const entropy32 = yield* generateEntropy()
  const signature = yield* mlDsa65SignHedged(message, keys.secretKey, keys.publicKey, context, entropy32)
  return yield* mlDsa65Verify(signature.signature, message, keys.publicKey, context)
})
```

`generateEntropy` reads the runtime CSPRNG through Noble and fails with `EntropyGenerationFailed` when the runtime has no `crypto.getRandomValues` or the requested length is outside what one call may draw; it deliberately does not use Effect's seedable `Random` service. XWing pairs X25519 with ML-KEM-768 so that the shared secret stays secure if either component is broken: `encapsulate("xwing", recipientPublicKey)` returns a `KemCiphertext` holding the ciphertext to send and the sender's copy of the shared secret, and `decapsulate("xwing", ciphertext, recipientSecretKey)` recovers the same secret on the receiving side.

## Public surface

The package exports plain functions and schemas from a single entrypoint.

| Area                | Exports                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic operations  | `generateKeyPair`, `generateEntropy`, `sign`, `verify`, `deriveSharedSecret`, `encapsulate`, `decapsulate`                                                                                         |
| Direct verification | `ed25519Verify`, `p256Sha256P1363LowSVerify`, `mlDsa65Verify`                                                                                                                                      |
| Algorithm functions | `ed25519Sign`, `mlDsa65SignHedged`, `mlDsa65SignDeterministic`, `xwingEncapsulate`, `xwingDecapsulate`, and peers                                                                                  |
| Schemas             | `KeyPair`, `Signature`, `SharedSecret`, `KemCiphertext`, `SignatureAlgorithm`, `AgreementAlgorithm`, `KemAlgorithm`                                                                                |
| Errors              | `SigningFailed`, `VerificationFailed`, `InvalidSignature`, `KeyGenerationFailed`, `EntropyGenerationFailed`, `AgreementFailed`, `KemFailed`, `InvalidVerificationInput`, `VerificationUnavailable` |
| Bytes               | `utf8ToBytes`, `toHex`, `equalBytes`                                                                                                                                                               |

The full list with signatures is in the [API reference](./src/index.ts).

## Errors and boundaries

The generic operations fail with `SigningFailed`, `VerificationFailed`, `InvalidSignature`, `KeyGenerationFailed`, `AgreementFailed`, or `KemFailed`. Most of these carry an algorithm and a diagnostic reason, so decide what a protocol may reveal before forwarding them across an untrusted boundary. The direct verifiers use the narrower material-free contract described above.

A successful verification proves that bytes were signed under a key. Whether that means anything depends on how the key was authenticated and how the message domain, context, encoding, and algorithm were bound. Shared secrets from X25519 and XWing are not keys until a KDF has processed them together with the protocol transcript. Secret keys and shared secrets need application-owned secure storage and destruction.

## Standards

The implemented profiles follow [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032), [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748), [SEC 2](https://www.secg.org/sec2-v2.pdf), [BIP 340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki), [FIPS 203](https://doi.org/10.6028/NIST.FIPS.203), [FIPS 204](https://doi.org/10.6028/NIST.FIPS.204), [FIPS 205](https://doi.org/10.6028/NIST.FIPS.205), and the [X-Wing specification](https://doi.org/10.62056/a3qj89n4e). The test suite checks independent standards vectors and strict admission cases. Noble's audits cover the primitive implementations; suite selection, key provenance, error handling, and protocol composition are reviewed separately in this package and in your application.

## Examples

The [examples directory](./examples/) contains three runnable programs: [Ed25519 signing and verification](./examples/01-sign-verify.ts), [X25519 key agreement](./examples/02-key-agreement.ts) between two parties, and [post-quantum signing and encapsulation](./examples/03-post-quantum.ts) with ML-DSA-65 and XWing.

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
