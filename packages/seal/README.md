# @scenesystems/seal

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

Authenticated encryption for the [Theoria](https://github.com/scenesystems/theoria) ecosystem.

## Features

- **XChaCha20-Poly1305** recommended AEAD (192-bit random nonce, unlimited key wear-out)
- **AES-256-GCM-SIV** nonce-misuse resistant AEAD
- **AES-256-GCM** widely deployed AEAD for compatibility
- **Sealed envelope** format (nonce ‖ ciphertext ‖ tag)
- **Effect-native** — Schema-typed values, typed errors, Effect pipelines
- **Typed errors** — `DecryptionFailed`, `InvalidKey`

## Install

```sh
bun add @scenesystems/seal effect
```

## Usage

```ts
import { sealEffect, SealedEnvelope } from "@scenesystems/seal"
import { Effect } from "effect"

const encrypted = sealEffect.encrypt("xchacha20-poly1305", key, data)
// Effect<SealedEnvelope, InvalidKey>

const decrypted = sealEffect.decrypt(key, envelope)
// Effect<Uint8Array, DecryptionFailed | InvalidKey>
```

## License

[MIT](../../LICENSE) — Copyright © 2026 Scene Systems
