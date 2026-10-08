# @scenesystems/sign

Effect-native digital signatures, X25519 key agreement, X-Wing hybrid encapsulation, and RS256 JWT verification. Cryptographic primitives come from Noble Curves, Hashes, and Post-Quantum. Applications own key authentication, message framing, authorization, storage, and secret destruction.

## Installation and imports

```sh
bun add @scenesystems/sign effect
```

Requires Effect `^4.0.0`. Import namespaces from the root or matching,
case-sensitive subpaths, such as `@scenesystems/sign/Ed25519`.

Choose the suite explicitly: Ed25519, secp256k1, ML-DSA, and SLH-DSA support
signing and verification; P256 and RSA support verification only. Use X25519
for agreement, X-Wing for hybrid encapsulation, and `Jwt` for RS256 token policy.
Use `Hex`, `Base64`, and `Base64Url` from `effect/encoding` for wire encodings.

## Sign and verify with an authenticated key

```ts typecheck
import { Bytes, Ed25519, Entropy } from "@scenesystems/sign"
import { Effect } from "effect"

export const program = Effect.gen(function* () {
  const keys = yield* Ed25519.generateKeyPair
  const message = yield* Bytes.fromString("signed content")
  const signed = yield* Ed25519.sign(message, keys.secretKey, keys.publicKey)
  const valid = yield* Ed25519.verify(signed.signature, message, keys.publicKey)
  return { signed, valid }
}).pipe(Effect.provide(Entropy.layer))
```

Every verifier takes a public key explicitly. Verification proves that bytes
match a key, not that the key belongs to an identity. A `Signature.Signature`
carries algorithm, signature bytes, and the supplied public key; it is not a
trusted identity or self-verifying envelope. Ed25519 signing checks the key
pair, but other signers may retain a supplied public key without proving it
matches the secret. Bind algorithm, context, and message framing in your
protocol. See the suite references for input admission and snapshot rules.

### Restore an Ed25519 identity

`Ed25519.keyPairFromSeed` validates and snapshots an exact 32-byte RFC 8032 seed on execution. It accepts neither an expanded 64-byte secret key nor a serialized key container. It returns independent caller-owned secret/public arrays without drawing key-generation entropy. `Ed25519.Seed` exposes the same size refinement as a branded Schema.

```ts typecheck
import * as Ed25519 from "@scenesystems/sign/Ed25519"
import { Effect } from "effect"
import { Hex } from "effect/encoding"

// Public RFC 8032 test vector, not a production secret.
export const restoredIdentity = Effect.gen(function* () {
  const seed = yield* Effect.fromResult(Hex.decode("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"))
  return yield* Ed25519.keyPairFromSeed(seed)
})
```

Invalid seed material fails with `Ed25519.InvalidSeed`, which retains no material. Backend derivation failures use `KeyPair.GenerationFailed` with a fixed diagnostic.

## Entropy

Provide [`Entropy.layer`](./src/Entropy.ts) at the application boundary for key generation, randomized signing, and encapsulation. It uses the runtime CSPRNG through Noble, not Effect's seedable `Random` service. Key generators are lazy Effect values: yield them directly, without `()`. Each execution draws fresh entropy.

`Entropy.bytes(length)` supplies explicit bytes for operations such as ML-DSA-65 hedged signing. Invalid requests and unavailable CSPRNGs fail with `Entropy.GenerationFailed`; the [reference](./src/Entropy.ts) describes limits and diagnostics.

Tests may substitute deterministic providers with `Effect.provideService`. **Never use test providers for production secrets.** This service controls generated key and signature material, not Noble's internal blinding randomness.

## Key agreement and encapsulation

```ts typecheck
import { Bytes, Entropy, X25519 } from "@scenesystems/sign"
import { Effect } from "effect"

export const agree = Effect.gen(function* () {
  const alice = yield* X25519.generateKeyPair
  const bob = yield* X25519.generateKeyPair
  const fromAlice = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
  const fromBob = yield* X25519.deriveSharedSecret(bob.secretKey, alice.publicKey)
  return Bytes.equal(fromAlice.sharedSecret, fromBob.sharedSecret)
}).pipe(Effect.provide(Entropy.layer))
```

`X25519.SharedSecret` contains the raw 32-byte agreement output. X25519 rejects all-zero shared output from low-order peers. It does not authenticate the peer or bind the transcript.

[`XWing`](./src/XWing.ts) combines X25519 and ML-KEM-768 under `draft-connolly-cfrg-xwing-kem-06`, not a finalized RFC. `encapsulate` returns a ciphertext to transmit and a shared secret to keep local; `decapsulate` recovers the recipient's secret. A modified ciphertext can derive another secret rather than fail. Neither operation authenticates the sender or recipient.

Apply a protocol-bound KDF before using either output as a symmetric key. [`@scenesystems/digest`](../digest/README.md) supplies HKDF and BLAKE3 key derivation; [`@scenesystems/seal`](../seal/README.md) encrypts under derived keys.

## Strict verification

`Ed25519.verify`, `P256.verify`, `MlDsa.verify65`, and `Rsa.verify` use a common contract:

| Outcome                                                     | Result                      |
| ----------------------------------------------------------- | --------------------------- |
| Canonical admitted signature matches                        | `true`                      |
| Canonical admitted signature does not match                 | `false`                     |
| Malformed, noncanonical, wrong-length, or unsupported input | `Verification.InvalidInput` |
| Admitted input reaches a backend that cannot execute        | `Verification.Unavailable`  |

Both errors retain no input material, algorithm, key, message, context, or backend diagnostic. Inputs are admitted and copied on every execution; mutation between executions is validated again. `Verification.maxMessageBytes` is 8,192, inclusive. **This resource bound is Theoria policy, not an algorithm or wire-format limit.** Cryptographic primitives execute synchronously and cannot be preempted by an Effect timeout.

[`Bytes.fromString`](./src/Bytes.ts) encodes UTF-8, replacing malformed UTF-16 with U+FFFD. Use digest's `Utf8.encode` when malformed text must fail. `Bytes.collect` buffers a byte stream within the 8,192-byte message limit; it does not perform incremental signing or prehashing.

- [`Ed25519`](./src/Ed25519.ts): strict RFC 8032, with ZIP-215 disabled.
- [`P256`](./src/P256.ts): SHA-256, uncompressed SEC1 keys, and low-S IEEE P1363 signatures, not DER.
- [`MlDsa`](./src/MlDsa.ts): FIPS 204 ML-DSA-65 with an explicit context; contexts are not interchangeable.
- [`Rsa`](./src/Rsa.ts): RSASSA-PKCS1-v1_5 with SHA-256 (RS256), not PSS. Import an authenticated JWK with `publicKeyFromJwk`.

Each linked suite reference specifies admitted encodings, lengths, and key constraints. Importing a key validates its representation, not its provenance.

The RSA scheme composes Noble public arithmetic with SHA-256 from `@scenesystems/digest`. **This Theoria composition is not covered by Noble's audits.** Independent OpenSSL fixtures and all 259 cases of a pinned Wycheproof corpus provide conformance evidence, not an audit.

## Post-quantum signing

```ts typecheck
import { Bytes, Entropy, MlDsa } from "@scenesystems/sign"
import { Effect } from "effect"

export const signDocument = Effect.gen(function* () {
  const keys = yield* MlDsa.generateKeyPair65
  const message = yield* Bytes.fromString("quantum-resistant document")
  const context = yield* Bytes.fromString("example.com/documents/v1")
  const entropy = yield* Entropy.bytes(MlDsa.entropyBytes)
  const signed = yield* MlDsa.sign65Hedged(message, keys.secretKey, keys.publicKey, context, entropy)
  return yield* MlDsa.verify65(signed.signature, message, keys.publicKey, context)
}).pipe(Effect.provide(Entropy.layer))
```

`MlDsa.sign65Hedged` requires exactly 32 caller-supplied fresh random bytes. `MlDsa.sign65Deterministic` is for empty-context conformance vectors. ML-DSA-44/87 use `sign44`/`sign87`, `verify44`/`verify87`, and `generateKeyPair44`/`generateKeyPair87`; signing draws entropy from the service and uses an empty context.

`SlhDsa` groups the four SHA2 parameter sets: `signSha2128f`, `signSha2128s`, `signSha2192f`, and `signSha2256f`, with corresponding verify and generate-key-pair operations. These are randomized, empty-context FIPS 205 signatures. SLH-DSA signing can be costly. `Secp256k1` similarly distinguishes `signEcdsa` from `signSchnorr`; ECDSA is deterministic low-S SHA-256, while Schnorr draws auxiliary entropy.

The non-strict secp256k1, ML-DSA-44/87, and SLH-DSA verifiers return false for nonmatches and `Signature.VerificationFailed` for backend exceptions. These diagnostics may contain backend text; they are not the strict material-free failure contract.

## JWT verification

```ts typecheck
import { Jwt } from "@scenesystems/sign"
import { HashSet, Redacted, Schema } from "effect"

const allowedEmails = HashSet.make("reader@example.test")
const Identity = Schema.Struct({
  sub: Schema.NonEmptyString,
  email: Schema.NonEmptyString.check(Schema.makeFilter((email) => HashSet.has(allowedEmails, email)))
})
const policy = new Jwt.Policy({
  issuer: "https://team.cloudflareaccess.com",
  audience: "configured-application-audience",
  maxLifetimeSeconds: 86400
})

export const authenticate = (token: Redacted.Redacted<string>, trustedJwks: unknown) =>
  Jwt.verifyRs256(token, trustedJwks, policy, Identity)
```

Authenticate the JWKS for the configured issuer before calling `verifyRs256`; the package performs no network lookup. Verification enforces issuer, audience, issuance, expiry, and maximum lifetime using Effect's Clock, with no clock skew. Application claims are decoded only after signature and policy checks pass. `Jwt.Rejected` retains no token material; backend unavailability remains distinct. JWKS input is limited to 100 keys and compact tokens to 8,876 characters. See [`Jwt`](./src/Jwt.ts) for the admitted header and claims profile.

## Data and failure boundaries

Use `Schema.decodeUnknownEffect` for untrusted data. Decoding a [`KeyPair`](./src/KeyPair.ts) or [`Signature`](./src/Signature.ts) model checks its representation, not cryptographic validity. Models do not redact or make mutable key bytes immutable. Select a wire codec explicitly for JSON transport; suite operations own cryptographic admission and verification.

## Verification and examples

Tests use retained RFC, ACVP, Wycheproof, and independent OpenSSL inputs, plus boundary/admission tests, deterministic entropy substitution, and a seeded X25519 agreement law. `bun run --filter @scenesystems/sign fixtures:check` validates retained payload schemas and fingerprints. After building, `bun run --filter @scenesystems/sign test:packed` runs public root/subpath APIs from an isolated tarball installation in Bun and native workerd without Node compatibility. See [fixture provenance](./test/fixtures/RSA-PROVENANCE.md) for sources and measurement limitations.

Runnable examples demonstrate [Ed25519](./examples/01-sign-verify.ts), [X25519](./examples/02-key-agreement.ts), and [ML-DSA-65 with X-Wing](./examples/03-post-quantum.ts). API contracts live on the [public declarations](./src/index.ts).

This package is pre-1.0; minor releases may change APIs. See the [changelog](./CHANGELOG.md), [contributing guide](../../CONTRIBUTING.md), and [security policy](../../SECURITY.md). [MIT](./LICENSE). Copyright 2026 Scene Systems.
