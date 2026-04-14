# @scenesystems/seal

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Authenticated encryption for Effect.

Use it when you need to encrypt application data without inventing your own nonce policy, wire format, or key-rotation story.

## Why Use It

- `seal(...)` and `unseal(...)` give you one released envelope path instead of algorithm-specific glue scattered through the codebase.
- XChaCha20-Poly1305 is the safest default for most application work, and AES-GCM-SIV plus AES-GCM are available when compatibility or misuse resistance matters.
- Associated data (AAD) lets you bind protocol context to ciphertext authentication without pushing that context into the envelope payload.
- Envelope key metadata gives callers a clean place to carry key-selection hints across rotation workflows.

## Installation

```sh
npm install @scenesystems/seal effect
```

Use `bun add` or `pnpm add` if that is your package manager.

## Quick Start

This is the common path: encrypt a study artifact, bind it to workflow context with AAD, and include key-selection metadata for rotation.

```ts typecheck
import {
  generateKey,
  seal,
  unseal,
  utf8FromBytes,
  utf8ToBytes
} from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const key = yield* generateKey(32)
  const associatedData = utf8ToBytes("workflow-comparison:baseline:v1")
  const plaintext = utf8ToBytes("Evidence citation increased after rotating facilitation.")

  const envelope = yield* seal(
    "xchacha20-poly1305",
    key,
    plaintext,
    {
      keyId: "research-archive-primary",
      keyVersion: 7
    },
    associatedData
  )

  const recovered = yield* unseal(key, envelope, associatedData)

  return {
    algorithm: envelope.algorithm,
    keyId: envelope.keyId,
    keyVersion: envelope.keyVersion,
    text: utf8FromBytes(recovered)
  }
})

void program
```

## Main Things You Can Do

The core pipeline is `seal(algorithm, key, plaintext, metadata?, associatedData?)` and `unseal(key, envelope, associatedData?)`.

Direct helpers are also available when you truly need algorithm-specific entrypoints: `xchacha20Encrypt(key, plaintext, associatedData?)`, `aesgcmsivEncrypt(key, plaintext, associatedData?)`, and `aesgcmEncrypt(key, plaintext, associatedData?)`.

### Envelope key metadata

Envelope key metadata is where `keyId` and `keyVersion` live. These values are transport-only envelope hints for key selection and rotation, and they are not cryptographically authenticated. Start with [`examples/03-envelope-metadata.ts`](./examples/03-envelope-metadata.ts).

### Associated data (AAD)

Associated data (AAD) is authenticated but not encrypted. It is the right place for stable protocol context such as workflow IDs, tenant IDs, or transcript revisions because it stays external to the `SealedEnvelope`. If the caller changes it, omits it, or binds the wrong value, decryption fails with the same encrypted payload. Start with [`examples/04-associated-data.ts`](./examples/04-associated-data.ts).

### Error and compatibility surface

- `InvalidKey` covers wrong key length.
- `InvalidAssociatedData` covers malformed or empty associated data.
- `DecryptionFailed` covers wrong-key and tampering failures.
- `SealedEnvelope` is the released transport shape for encrypted payloads.

## Learn More

- Start with [`examples/01-encrypt-decrypt.ts`](./examples/01-encrypt-decrypt.ts) for the baseline envelope round-trip.
- Use [`examples/02-algorithm-comparison.ts`](./examples/02-algorithm-comparison.ts) when you need to compare XChaCha20-Poly1305, AES-256-GCM-SIV, and AES-256-GCM.
- Use [`examples/03-envelope-metadata.ts`](./examples/03-envelope-metadata.ts) for key rotation and [`examples/04-associated-data.ts`](./examples/04-associated-data.ts) for protocol binding.
- Runtime interoperability proof is fixture-backed: pinned raw `@noble/ciphers` fixtures prove that `unseal(...)` decrypts externally generated envelopes and `packEnvelope(...)` reconstructs the same released wire format after metadata and AAD are applied.
- From the repository root, run `bun run docs:packages -- --package @scenesystems/seal --view agent` for the generated docs surface.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
