# @scenesystems/sign

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect-native digital signatures, key agreement, and hybrid post-quantum key
encapsulation.

Use it when you want typed cryptographic workflows without leaking low-level
library details into the rest of your program.

## Why Use It

- One package for signatures, shared-secret agreement, and KEM workflows.
- Classical and post-quantum algorithms behind the same Effect-native surface.
- Self-describing output types that preserve algorithm identity at runtime.
- Detached signatures, verify-many reporting, and portable codecs for real transport boundaries.
- Built on the audited [Noble](https://paulmillr.com/noble/) cryptographic ecosystem.

## Installation

```sh
npm install @scenesystems/sign effect
```

Use the equivalent `pnpm add` or `bun add` command if that is your package
manager.

## Quick Start

```ts typecheck
import { Effect } from "effect"
import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("transfer 100 tokens to Alice")

  const signature = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  const valid = yield* verify(signature, message)

  return { algorithm: signature.algorithm, valid }
})

Effect.runPromise(program)
```

## Choosing An Algorithm

- Use `ed25519` for general-purpose signing.
- Use `secp256k1-ecdsa` or `secp256k1-schnorr` when you need blockchain interoperability.
- Use `ml-dsa-65` when you want a practical post-quantum signature default.
- Use `slh-dsa-*` when you want conservative hash-based post-quantum signatures and can tolerate slower signing.
- Use `x25519` for classical shared-secret agreement.
- Use `xwing` for hybrid post-quantum key establishment.

## Common Tasks

| Task                                  | Start here                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Sign and verify a message             | [`examples/01-sign-verify.ts`](./examples/01-sign-verify.ts)               |
| Derive a shared secret with X25519    | [`examples/02-key-agreement.ts`](./examples/02-key-agreement.ts)           |
| Use post-quantum signatures and XWing | [`examples/03-post-quantum.ts`](./examples/03-post-quantum.ts)             |
| Exchange detached signatures          | [`examples/04-detached-signature.ts`](./examples/04-detached-signature.ts) |
| Verify many mixed signatures          | [`examples/05-verify-many.ts`](./examples/05-verify-many.ts)               |
| Encode and decode portable carriers   | [`examples/06-key-codecs.ts`](./examples/06-key-codecs.ts)                 |

The main public operations are `generateKeyPair`, `sign`, `verify`,
`signDetached`, `verifyDetached`, `verifyMany`, `deriveSharedSecret`,
`encapsulate`, and `decapsulate`.

## Algorithm Support Matrix

| Family | Algorithm | Standard | Release status |
| ------ | --------- | -------- | -------------- |
| Signature | `ed25519` | RFC 8032 | stable |
| Signature | `secp256k1-ecdsa` | RFC 6979 | stable |
| Signature | `secp256k1-schnorr` | BIP-340 | stable |
| Signature | `ml-dsa-44` | FIPS 204 | stable |
| Signature | `ml-dsa-65` | FIPS 204 | stable |
| Signature | `ml-dsa-87` | FIPS 204 | stable |
| Signature | `slh-dsa-sha2-128f` | FIPS 205 | stable |
| Signature | `slh-dsa-sha2-128s` | FIPS 205 | stable |
| Signature | `slh-dsa-sha2-192f` | FIPS 205 | stable |
| Signature | `slh-dsa-sha2-256f` | FIPS 205 | stable |
| Agreement | `x25519` | RFC 7748 | stable |
| KEM | `xwing` | X-Wing / CFRG hybrid KEM | stable |

### Signatures

Use `sign` and `verify` for self-describing signatures, or `signDetached` and
`verifyDetached` when the signature must travel separately from identity
material.

### Key agreement

Use `deriveSharedSecret` for X25519 shared-secret agreement.

### Key encapsulation (KEM)

Use `encapsulate` and `decapsulate` for hybrid XWing key establishment.

### Detached signatures

Detached signatures support explicit-key verification across transport
boundaries where the public key is carried separately.

### Verify many signatures

Use `verifyMany` when you need ordered, per-item outcomes across a collection
of self-describing and detached signatures. It reports per-item outcomes
without claiming a cryptographic batch optimization.

### Portable codecs

Use `encodeKeyPair`, `decodeKeyPair`, `encodeSignature`, `decodeSignature`,
`encodeSharedSecret`, `decodeSharedSecret`, `toBase64Url`, and `fromBase64Url`
to move artifacts across process and network boundaries. The portable carrier
types are `PortableKeyPair`, `PortableSignature`, and `PortableSharedSecret`.

## Learn More

- Browse the runnable examples in [`examples/`](./examples).
- Use `bun run docs:packages -- --catalog` from the repository root for the generated docs corpus.
- See [`@scenesystems/digest`](../digest/README.md) and [`@scenesystems/seal`](../seal/README.md) for companion cryptographic boundary packages.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
