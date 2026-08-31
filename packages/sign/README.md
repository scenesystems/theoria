# @scenesystems/sign

`@scenesystems/sign` provides digital signatures, X25519 key agreement, and XWing hybrid key encapsulation for [Effect](https://effect.website). These families have separate operations and output schemas because their security roles are distinct. Signatures authenticate possession of a signing key under a caller-defined identity policy. Agreement and encapsulation produce shared secret material that should be passed through an appropriate KDF before use.

The package does not provide identity, authorization, certificates, trust roots, key storage, rotation, transcript construction, or protocol policy. A KEM is unauthenticated on its own, so protocols must bind recipient keys and transcripts through an authenticated mechanism.

## Installation

```sh
npm install @scenesystems/sign effect
```

Effect `^3.22.1` is supported and required as a peer dependency. The package has one public entrypoint, `@scenesystems/sign`.

## Basic use

```ts typecheck
import { ed25519Verify, generateKeyPair, sign, utf8ToBytes } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("signed content")
  const signed = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  const valid = yield* ed25519Verify(signed.signature, message, keys.publicKey)
  return { signed, valid }
})
```

Protocols that own suite selection should use a direct verifier with a public key supplied independently from the signature. The generic `verify` operation instead dispatches from the algorithm and public key carried by `Signature` and is suitable only when that self-describing model is explicitly part of the protocol.

## Supported families

| Family     | Algorithms                                                                    | Main operations                                 |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| Signatures | Ed25519, secp256k1 ECDSA and Schnorr, ML-DSA-44/65/87, four SLH-DSA SHA2 sets | `sign`, `verify`, algorithm-specific operations |
| Agreement  | X25519                                                                        | `deriveSharedSecret`                            |
| KEM        | XWing using X25519 and ML-KEM-768                                             | `encapsulate`, `decapsulate`                    |

`generateKeyPair` accepts every algorithm in these families. Schema classes `KeyPair`, `Signature`, `SharedSecret`, and `KemCiphertext` carry algorithm tags with their byte fields. Encoding helpers include `utf8ToBytes`, `toHex`, and `equalBytes`.

Production ML-DSA-65 signing requires `mlDsa65SignHedged` with exactly 32 bytes of fresh caller-supplied cryptographic entropy and an explicit FIPS 204 context. `mlDsa65SignDeterministic` exists for conformance use. The legacy `mlDsa65Sign` and generic `sign("ml-dsa-65", ...)` fail closed because those signatures cannot accept explicit hedging entropy. Runnable programs cover [Ed25519 signing](./examples/01-sign-verify.ts), [X25519 agreement](./examples/02-key-agreement.ts), and [ML-DSA-65 with XWing](./examples/03-post-quantum.ts).

## Strict direct verification

`ed25519Verify`, `p256Sha256P1363LowSVerify`, and `mlDsa65Verify` take detached signature bytes, protected message bytes, and an explicit public key. They never dispatch from an algorithm field and never accept or return the self-describing `Signature` carrier.

Their result contract is strict:

| Input or verification result                                          | Effect result              |
| --------------------------------------------------------------------- | -------------------------- |
| Canonical, admitted signature verifies                                | `true`                     |
| Canonical, admitted signature does not verify                         | `false`                    |
| Malformed, noncanonical, wrong-length, or unsupported primitive input | `InvalidVerificationInput` |
| Admitted input reaches an unavailable backend                         | `VerificationUnavailable`  |

Both errors are material-free. They contain no algorithm, key, signature, message, context, provider reason, or underlying exception. Inputs are admitted and copied lazily on every execution of the returned Effect. Expected type, bound, detached-buffer, and typed-array copy failures are reported as typed failures during execution. Primitive calls execute synchronously and cannot be cooperatively interrupted.

The direct profiles are fixed:

- Ed25519 follows pure RFC 8032. Public keys and signature `R` points must use canonical, non-small-order encodings; `S` must be below the subgroup order; ZIP-215 behavior is disabled. Public keys are 32 bytes and signatures are 64 bytes.
- P-256 applies SHA-256 exactly once. Public keys must be 65-byte uncompressed SEC1 encodings and signatures must be 64-byte IEEE P1363 `r || s` with in-range scalars and low S. DER, compressed keys, high-S signatures, malformed points, and alternate encodings are rejected.
- ML-DSA-65 follows pure FIPS 204. Public keys are 1,952 bytes, signatures are 3,309 bytes, hint encoding must be canonical, and context is explicit. Empty and nonempty contexts define distinct profiles.

Direct verification admits protected messages through 8,192 bytes, with larger messages rejected before primitive execution. This provider execution bound does not define a wire-format limit. Callers must enforce their own transcript and message-size policy.

## Errors and security boundaries

The general operations expose typed `SigningFailed`, `VerificationFailed`, `InvalidSignature`, `KeyGenerationFailed`, `AgreementFailed`, and `KemFailed` errors. Most carry an algorithm and diagnostic reason, so do not expose them across an untrusted boundary without deciding what information the protocol may reveal. Direct verifier errors use the narrower redacted contract described above.

A successful signature verifies bytes under a key. Identity depends on how the key was authenticated and how the message domain, context, encoding, and algorithm were bound. Shared secrets from X25519 and XWing require KDF processing and transcript binding. Secret keys and generated shared secrets require application-owned secure storage and destruction policy.

## Standards and conformance

The implemented profiles draw from [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032), [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748), [SEC 2](https://www.secg.org/sec2-v2.pdf), [BIP 340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki), [FIPS 203](https://doi.org/10.6028/NIST.FIPS.203), [FIPS 204](https://doi.org/10.6028/NIST.FIPS.204), [FIPS 205](https://doi.org/10.6028/NIST.FIPS.205), and the [X-Wing specification](https://doi.org/10.62056/a3qj89n4e). Tests include independent standards vectors and strict admission cases.

Primitive implementations come from the Noble Curves, Hashes, and Post-Quantum projects. Their audit coverage does not replace review of suite selection, key provenance, error handling, or protocol composition.

## Status

This package is pre-1.0. Minor releases may change public APIs while contracts are refined. Review the [changelog](./CHANGELOG.md) before upgrading.

## Contribution and support

See the repository [contribution guide](../../CONTRIBUTING.md) for development and review requirements. Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for questions and bug reports. Report security-sensitive concerns through the [security policy](../../SECURITY.md).

## License

[MIT](./LICENSE) - Copyright 2026 Scene Systems
