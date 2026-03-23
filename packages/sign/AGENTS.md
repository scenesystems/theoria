---
description: Development guidelines for @scenesystems/sign
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/sign

Digital signatures, key agreement, and key encapsulation for Effect.

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |

All four gates must pass clean before any work is considered complete.

## Architecture

Single entrypoint — `@scenesystems/sign`. Effect is a required
peer dependency. Schema is the single source of truth for all types.

### Three Cryptographic Families

| Family        | Algorithms                          | Operations                       | Output type     |
| ------------- | ----------------------------------- | -------------------------------- | --------------- |
| **Signature** | Ed25519, secp256k1, ML-DSA, SLH-DSA | `sign()`, `verify()`             | `Signature`     |
| **Agreement** | X25519                              | `deriveSharedSecret()`           | `SharedSecret`  |
| **KEM**       | XWing (X25519 + ML-KEM-768)         | `encapsulate()`, `decapsulate()` | `KemCiphertext` |

These are NOT interchangeable — you cannot `sign()` with X25519
or `verify()` an XWing output.

### Modules

**Signature modules:**

- `src/algorithms/ed25519.ts` — Ed25519 EdDSA signatures (RFC 8032)
- `src/algorithms/secp256k1.ts` — secp256k1 ECDSA + Schnorr (BIP-340)
- `src/algorithms/mlDsa.ts` — ML-DSA (Dilithium, FIPS-204) post-quantum signatures
- `src/algorithms/slhDsa.ts` — SLH-DSA (SPHINCS+, FIPS-205) hash-based post-quantum
- `src/sign.ts` — unified sign/verify pipeline with algorithm dispatch

**Agreement modules:**

- `src/algorithms/x25519.ts` — X25519 ECDH key agreement (RFC 7748)
- `src/agreement.ts` — key agreement pipeline

**KEM modules:**

- `src/algorithms/hybrid.ts` — XWing hybrid KEM (X25519 + ML-KEM-768)
- `src/kem.ts` — key encapsulation pipeline (encapsulate/decapsulate)

**Shared modules:**

- `src/keyPair.ts` — key generation for all algorithms

### Schemas (`src/schemas/`)

**Signature schemas:**

- `src/schemas/SignatureAlgorithm.ts` — `Schema.Literal` union of signature algorithms
- `src/schemas/KeyPair.ts` — `Schema.Class` for typed key pairs
- `src/schemas/Signature.ts` — `Schema.Class` for algorithm-tagged signatures

**Agreement schemas:**

- `src/schemas/AgreementAlgorithm.ts` — `Schema.Literal` union (`"x25519"`)
- `src/schemas/SharedSecret.ts` — `Schema.Class` for agreement output

**KEM schemas:**

- `src/schemas/KemAlgorithm.ts` — `Schema.Literal` union (`"xwing"`)
- `src/schemas/KemCiphertext.ts` — `Schema.Class` for KEM output

**Shared schemas:**

- `src/schemas/errors.ts` — `Schema.TaggedError` types

### Internal (`src/internal/`)

Private implementation. Blocked from consumers via exports map.

- `src/internal/keyEncoding.ts` — key serialization/deserialization
- `src/internal/algorithmRegistry.ts` — algorithm dispatch registry

## Classical vs Post-Quantum

| Class        | Algorithms                  | Family    | Standards          | Quantum-safe? |
| ------------ | --------------------------- | --------- | ------------------ | ------------- |
| Classical    | Ed25519, secp256k1          | Signature | RFC 8032, BIP-340  | No            |
| Classical    | X25519                      | Agreement | RFC 7748           | No            |
| Post-quantum | ML-DSA, SLH-DSA             | Signature | FIPS-204, FIPS-205 | Yes           |
| Hybrid       | XWing (X25519 + ML-KEM-768) | KEM       | CG Framework       | Yes           |

**NIST IR 8547** prohibits classical-only cryptography after 2035.
**Australian ASD** prohibits classical-only after 2030.

## Conventions

- **Effect-native discipline** — no async/await, throw/try-catch, new Error(), console.\*, let, for/while, switch
- **Tests always use `@effect/vitest`** with `it.effect()` for schema tests
- **Known test vectors** from RFC 8032, BIP-340, RFC 7748, NIST FIPS-204, FIPS-205
- **Schema is the single source of truth** — types are defined as Schema in `src/schemas/`, extracted via `Schema.Type` and `import type`
- **Three families are not interchangeable** — signature, agreement, and KEM types are distinct

## Governance

- `internal/*` blocked from consumers via exports map
- No `@noble/curves` or `@noble/post-quantum` types leak through public surface
- 240 LOC file-size limit applies
