# @scenesystems/sign

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Digital signatures, key agreement, and key encapsulation for the [Theoria](https://github.com/scenesystems/theoria) ecosystem.

## Features

- **Ed25519** primary signature algorithm (RFC 8032)
- **secp256k1** ECDSA + Schnorr (BIP-340)
- **X25519** ECDH key agreement (RFC 7748)
- **ML-DSA** (Dilithium) post-quantum signatures (FIPS-204)
- **SLH-DSA** (SPHINCS+) hash-based post-quantum (FIPS-205)
- **Hybrid** classical + post-quantum (XWing)
- **Effect-native** — Schema-typed values, typed errors, Effect pipelines
- **Branded types** — `SignatureAlgorithm`, `KeyPair`, `Signature`

## Install

```sh
bun add @scenesystems/sign effect
```

## Usage

```ts
import { signEffect, Signature, generateKeyPairEffect } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const keys = yield* generateKeyPairEffect("ed25519")
  const sig = yield* signEffect("ed25519", message, keys.secretKey)
  return sig
})
```

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
