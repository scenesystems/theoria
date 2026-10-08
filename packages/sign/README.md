# @scenesystems/sign

Sign provides digital signatures and key agreement for [Effect](https://effect.website), with RS256 JWT verification for token-based authentication. It uses Noble's cryptographic primitives. Your application must authenticate keys and define the protocol that uses them, including message framing and authorization. Key storage and destruction also remain the application's responsibility.

## Installation

```sh
bun add @scenesystems/sign effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/sign/Ed25519`.

Choose the suite explicitly: Ed25519, secp256k1, ML-DSA, and SLH-DSA support
signing and verification; P256 and RSA support verification only. Use X25519
for agreement, X-Wing for hybrid encapsulation, and `Jwt` for RS256 token policy.
Use `Hex`, `Base64`, and `Base64Url` from `effect/encoding` for wire encodings.

## Basic use

Generate an Ed25519 key pair, sign a message, and verify the signature.

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

Every verifier requires a public key that you have authenticated separately.
A successful verification proves that the signed bytes match that key.
The `Signature.Signature` returned by signing includes a public key, but the
model does not establish who owns it. Ed25519 signing checks that the supplied
keys form a pair; other signers may retain the public key without that check.
Your protocol must bind the algorithm and context to the message being signed.
See each suite's reference for its input validation and byte-copying behavior.

### Restore an Ed25519 identity

Pass a 32-byte RFC 8032 seed to `Ed25519.keyPairFromSeed` to restore a key pair.
The operation validates and copies the seed when executed, then returns fresh
secret and public key arrays without acquiring entropy. Expanded 64-byte secret
keys and serialized key containers are not accepted. Use `Ed25519.Seed` when
you need the size check as a branded Schema.

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

Neither error contains input data or backend diagnostics. Each execution
validates and copies its inputs, so changes between executions are checked
again. Theoria limits messages to `Verification.maxMessageBytes` (8,192 bytes,
inclusive) to bound resource use. **The limit comes from Theoria, not the
cryptographic algorithm.** An Effect timeout cannot interrupt a synchronous
cryptographic operation.

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

## Errors and validation

Use `Schema.decodeUnknownEffect` to check the representation of untrusted
[`KeyPair`](./src/KeyPair.ts) or [`Signature`](./src/Signature.ts) data, then use
the suite operations for cryptographic verification. The models leave key bytes
mutable and unredacted. Choose a wire codec explicitly when transporting them as JSON.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Ed25519 signing and verification](./examples/01-sign-verify.ts)
- [X25519 key agreement](./examples/02-key-agreement.ts)
- [ML-DSA-65 and X-Wing](./examples/03-post-quantum.ts)

## Verification

Tests use retained RFC, ACVP, Wycheproof, and independent OpenSSL inputs, plus boundary/admission tests, deterministic entropy substitution, and a seeded X25519 agreement law. `bun run --filter @scenesystems/sign fixtures:check` validates retained payload schemas and fingerprints. After building, `bun run --filter @scenesystems/sign test:packed` runs public root/subpath APIs from an isolated tarball installation in Bun and native workerd without Node compatibility. See [fixture provenance](./test/fixtures/RSA-PROVENANCE.md) for sources and measurement limitations.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
