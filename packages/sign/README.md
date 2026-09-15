# @scenesystems/sign

Effect-native digital signatures, X25519 key agreement, X-Wing hybrid encapsulation, and RS256 JWT verification. Cryptographic primitives come from Noble Curves, Hashes, and Post-Quantum. Applications own key authentication, message framing, authorization, storage, and secret destruction.

## Installation and imports

```sh
bun add @scenesystems/sign effect
```

Effect `^3.22.1` is a required peer. Public concerns are namespaces with matching, case-sensitive subpaths. Both forms expose the same declarations:

```ts typecheck
import { Ed25519 } from "@scenesystems/sign"
import * as Rsa from "@scenesystems/sign/Rsa"

export const reconstruct = Ed25519.keyPairFromSeed
export const importPublicKey = Rsa.publicKeyFromJwk
```

Choose the suite explicitly. `Ed25519`, `Secp256k1`, `MlDsa`, and `SlhDsa` own signing and verification; `P256` and `Rsa` are verification-only. `X25519` owns agreement, `XWing` owns encapsulation, and `Jwt` owns token policy. `KeyPair` and `Signature` own the shared data representations. `Verification` owns the strict-verification failure contract and resource limit. `Entropy` is the cryptographic random capability; `Bytes` prepares UTF-8 messages and compares byte sequences. Use Effect's `Encoding` directly for hex and base64.

## Sign and verify with an authenticated key

```ts typecheck
import { Bytes, Ed25519, Entropy } from "@scenesystems/sign"
import { Effect } from "effect"

export const program = Effect.gen(function* () {
  const keys = yield* Ed25519.generateKeyPair()
  const message = Bytes.fromString("signed content")
  const signed = yield* Ed25519.sign(message, keys.secretKey, keys.publicKey)
  const valid = yield* Ed25519.verify(signed.signature, message, keys.publicKey)
  return { signed, valid }
}).pipe(Effect.provide(Entropy.layer))
```

Every verifier takes a public key explicitly. Verification proves that bytes match a key, not that the key belongs to an identity. A `Signature.Signature` carries algorithm, signature bytes, and the supplied public key, but is not a trusted identity or self-verifying envelope. Ed25519 signing checks the key pair and snapshots the inputs; the other signers store the supplied public key without proving that it matches the secret key. Bind algorithm, context, and message framing in your protocol.

### Restore an Ed25519 identity

`Ed25519.keyPairFromSeed` validates and snapshots an exact 32-byte RFC 8032 seed on execution. It accepts neither an expanded 64-byte secret key nor a serialized key container. It returns independent caller-owned secret/public arrays without drawing key-generation entropy. `Ed25519.Seed` exposes the same size refinement as a branded Schema.

```ts typecheck
import * as Ed25519 from "@scenesystems/sign/Ed25519"
import { Effect, Encoding } from "effect"

// Public RFC 8032 test vector, not a production secret.
export const restoredIdentity = Effect.gen(function* () {
  const seed = yield* Encoding.decodeHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
  return yield* Ed25519.keyPairFromSeed(seed)
})
```

Invalid seed material fails with `Ed25519.InvalidSeed`, which retains no material. Backend derivation failures use `KeyPair.GenerationFailed` with a fixed diagnostic.

## Entropy is a dependency, not a hidden default

`Entropy.bytes(length)` requests an explicit number of fresh bytes. `Entropy.layer` uses the runtime CSPRNG through Noble, not Effect's reproducible `Random` service. It accepts integer lengths from 0 through 65,536. Rejected lengths and unavailable CSPRNGs fail with `Entropy.GenerationFailed`.

All key generation requires `Entropy.Entropy`. So do Schnorr, ML-DSA-44/87 and SLH-DSA randomized signing, and X-Wing encapsulation. Provide `Entropy.layer` near the application entrypoint. Services that generate identities can consume it through `Layer.provide`.

Ed25519 and ECDSA signing, ML-DSA-65 deterministic signing, verification, agreement, and decapsulation do not require this service. ML-DSA-65 hedged signing takes entropy bytes directly, so the caller chooses where to obtain them.

Tests may substitute deterministic byte providers with `Effect.provideService(Entropy.Entropy, ...)`; **never use those providers for production secrets**. Explicit entropy governs key and signature output. Noble may separately use native randomness for scalar/inversion blinding, which this service does not disable or replace.

## Agreement and encapsulation produce raw secrets

```ts typecheck
import { Bytes, Entropy, X25519 } from "@scenesystems/sign"
import { Effect } from "effect"

export const agree = Effect.gen(function* () {
  const alice = yield* X25519.generateKeyPair()
  const bob = yield* X25519.generateKeyPair()
  const fromAlice = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
  const fromBob = yield* X25519.deriveSharedSecret(bob.secretKey, alice.publicKey)
  return Bytes.equal(fromAlice.sharedSecret, fromBob.sharedSecret)
}).pipe(Effect.provide(Entropy.layer))
```

`X25519.SharedSecret` contains the raw 32-byte agreement output. X25519 rejects all-zero shared output from low-order peers. It does not authenticate the peer or bind the transcript.

`XWing.encapsulate(recipientPublicKey)` returns `XWing.Encapsulation`: a 1,120-byte ciphertext to transmit and the sender's 32-byte raw shared secret, which must remain local. `XWing.decapsulate(ciphertext, recipientSecretKey)` recovers the recipient's secret. X-Wing uses a 1,216-byte public key and 32-byte secret seed, combining X25519 and ML-KEM-768. Encapsulation requires 64 fresh entropy bytes. A well-sized modified ciphertext can derive another secret rather than fail; encapsulation does not authenticate the sender or recipient.

Apply a protocol-bound KDF before using either output as a symmetric key. [`@scenesystems/digest`](../digest/README.md) supplies HKDF and BLAKE3 key derivation; [`@scenesystems/seal`](../seal/README.md) encrypts under derived keys.

## Strict verification distinguishes rejection from nonmatch

`Ed25519.verify`, `P256.verify`, `MlDsa.verify65`, and `Rsa.verify` use a common contract:

| Outcome                                                     | Result                      |
| ----------------------------------------------------------- | --------------------------- |
| Canonical admitted signature matches                        | `true`                      |
| Canonical admitted signature does not match                 | `false`                     |
| Malformed, noncanonical, wrong-length, or unsupported input | `Verification.InvalidInput` |
| Admitted input reaches a backend that cannot execute        | `Verification.Unavailable`  |

Both errors retain no input material, algorithm, key, message, context, or backend diagnostic. Inputs are admitted and copied on every execution; mutation between executions is validated again. `Verification.maxMessageBytes` is 8,192, inclusive. **This resource bound is Theoria policy, not an algorithm or wire-format limit.** Cryptographic primitives execute synchronously and cannot be preempted by an Effect timeout.

- **Ed25519:** strict RFC 8032, ZIP-215 disabled. Public keys and signature R must be canonical and non-small-order; S must be below the subgroup order. Keys are 32 bytes, signatures 64.
- **P-256:** SHA-256 exactly once, 65-byte uncompressed SEC1 key, 64-byte IEEE P1363 signature with low S. DER, compressed keys, and high S fail admission.
- **ML-DSA-65:** explicit FIPS 204 context of 0–255 bytes, 1,952-byte public key, 3,309-byte signature with canonical hint encoding. Contexts are not interchangeable.
- **RSA:** fixed RSASSA-PKCS1-v1_5 with SHA-256, modulus-width signature, representative below the modulus, and complete RFC 8017 padding/DER DigestInfo comparison including NULL parameters. BER and missing-NULL alternatives do not verify.

`Rsa.publicKeyFromJwk(unknown)` admits canonical unpadded Base64urlUInt n/e into `Rsa.PublicKey`. Its modulus must be odd and 2048–4096 bits; its exponent odd and 3–2³²−1. Optional alg/use/key_ops must permit RS256 verification. Extra fields, including private material, are discarded. It validates neither prime factorization nor provenance. Rejection is the material-free `Rsa.InvalidPublicKey`. There is no RSA signing, encryption, PSS, or network lookup.

The RSA scheme composes Noble public arithmetic and hashing. **This Theoria composition is not covered by Noble's audits.** Independent OpenSSL fixtures and all 259 cases of a pinned Wycheproof corpus provide conformance evidence, not an audit.

## Post-quantum signing keeps context and entropy explicit

```ts typecheck
import { Bytes, Entropy, MlDsa } from "@scenesystems/sign"
import { Effect } from "effect"

export const signDocument = Effect.gen(function* () {
  const keys = yield* MlDsa.generateKeyPair65()
  const message = Bytes.fromString("quantum-resistant document")
  const context = Bytes.fromString("example.com/documents/v1")
  const entropy = yield* Entropy.bytes(MlDsa.entropyBytes)
  const signed = yield* MlDsa.sign65Hedged(message, keys.secretKey, keys.publicKey, context, entropy)
  return yield* MlDsa.verify65(signed.signature, message, keys.publicKey, context)
}).pipe(Effect.provide(Entropy.layer))
```

`MlDsa.sign65Hedged` requires exactly 32 caller-supplied fresh random bytes. `MlDsa.sign65Deterministic` is for empty-context conformance vectors. ML-DSA-44/87 use `sign44`/`sign87`, `verify44`/`verify87`, and `generateKeyPair44`/`generateKeyPair87`; signing draws entropy from the service and uses an empty context.

`SlhDsa` groups the four SHA2 parameter sets: `signSha2128f`, `signSha2128s`, `signSha2192f`, and `signSha2256f`, with corresponding verify and generate-key-pair operations. These are randomized, empty-context FIPS 205 signatures. SLH-DSA signing can be costly. `Secp256k1` similarly distinguishes `signEcdsa` from `signSchnorr`; ECDSA is deterministic low-S SHA-256, while Schnorr draws auxiliary entropy.

The non-strict secp256k1, ML-DSA-44/87, and SLH-DSA verifiers return false for nonmatches and `Signature.VerificationFailed` for backend exceptions. These diagnostics may contain backend text; they are not the strict material-free failure contract.

## JWT policy is separate from cryptographic verification

```ts typecheck
import { Jwt } from "@scenesystems/sign"
import { HashSet, Redacted, Schema } from "effect"

const allowedEmails = HashSet.make("reader@example.test")
const Identity = Schema.Struct({
  sub: Schema.NonEmptyString,
  email: Schema.NonEmptyString.pipe(Schema.filter((email) => HashSet.has(allowedEmails, email)))
})
const policy = new Jwt.Policy({
  issuer: "https://team.cloudflareaccess.com",
  audience: "configured-application-audience",
  maxLifetimeSeconds: 86400
})

export const authenticate = (token: Redacted.Redacted<string>, trustedJwks: unknown) =>
  Jwt.verifyRs256(token, trustedJwks, policy, Identity)
```

The caller authenticates the JWKS for the configured issuer. `Jwt` performs no HTTP, caching, or token-directed lookup. Exactly one key must match kid, even if duplicates are equal; the JWKS is bounded to 100 keys. Protected headers admit only alg: RS256, kid, and optional typ: JWT. Compact input is bounded to 8,876 characters, and the signed input also obeys the RSA message bound. Base64url must be canonical; malformed UTF-8 and BOMs are rejected. JSON duplicate names follow ECMAScript last-member semantics permitted by RFC 7519.

Issuer, audience, iat, and exp are required; nbf is optional and enforced. Comparisons are case-sensitive, expiration exclusive, issuance/not-before inclusive, maximum lifetime positive and bounded, with no clock skew. Verification reads Effect's Clock on execution. No claims escape before signature and policy verification. Application Schema requirements and interruption/finalization semantics are preserved. `Jwt.Rejected` reports a stage without retaining material; `Verification.Unavailable` remains distinct.

## Data and failure boundaries

Schema classes unify constructors, schemas, and types. `new KeyPair.KeyPair(...)` takes typed constructor input and validates it; invalid construction can throw. Use `Schema.decodeUnknown` for untrusted input and an explicit failure channel. `Signature.Signature`, `X25519.SharedSecret`, and `XWing.Encapsulation` check discriminators and byte carriers, not suite-specific lengths or cryptographic validity. Their encoded byte fields remain Uint8Arrays, not JSON strings. `Rsa.PublicKey` uses bigints. Compose a wire codec explicitly when crossing JSON boundaries.

Classes do not make nested mutable bytes structurally equal, copy them, or redact secrets. Key and signature algorithms are canonical literal schemas under `KeyPair.Algorithm` and `Signature.Algorithm`. Suite-specific failures live with their concern; shared generation failures live in `KeyPair`, signing failures in `Signature`. Wire tags are retained, but local names and paths are intentionally redesigned.

## Migrating from 0.4

This is a breaking pre-1.0 minor redesign, without aliases. Replace root flat functions with concern namespaces. Replace generic dispatch with explicit suite operations and independently authenticated verification keys. Replace the flat `KeyPair` class with `KeyPair.KeyPair`, `KemCiphertext` with `XWing.Encapsulation`, `generateEntropy()` with `Entropy.bytes(length)` plus an explicit layer, `utf8ToBytes` with `Bytes.fromString`, `equalBytes` with `Bytes.equal`, and `toHex` with Effect's `Encoding.encodeHex`.

Public subpaths are the exact PascalCase module names; `internal/`, legacy `algorithms/`, and `schemas/` paths are not exported. Distribution manifests are produced by the existing build-utils pack workflow from the explicit package export map.

## Verification and examples

Tests use retained RFC, ACVP, Wycheproof, and independent OpenSSL inputs, plus boundary/admission tests, deterministic entropy substitution, and a seeded X25519 agreement law. `bun run --filter @scenesystems/sign fixtures:check` validates retained payload schemas and fingerprints. After building, `bun run --filter @scenesystems/sign test:packed` runs public root/subpath APIs from an isolated tarball installation in Bun and native workerd without Node compatibility. See [fixture provenance](./test/fixtures/RSA-PROVENANCE.md) for sources and measurement limitations.

Runnable examples demonstrate [Ed25519](./examples/01-sign-verify.ts), [X25519](./examples/02-key-agreement.ts), and [ML-DSA-65 with X-Wing](./examples/03-post-quantum.ts). API contracts live on the [public declarations](./src/index.ts).

This package is pre-1.0; minor releases may change APIs. See the [changelog](./CHANGELOG.md), [contributing guide](../../CONTRIBUTING.md), and [security policy](../../SECURITY.md). [MIT](./LICENSE). Copyright 2026 Scene Systems.
