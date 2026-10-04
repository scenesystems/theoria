---
description: Development guidelines for @scenesystems/seal
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/seal

Authenticated encryption for Effect. Follow the root four-gate workflow.

## Concern ownership

- `src/Cipher.ts` owns the algorithm schema/type, key policy, failures, backend Context service, operations, and `layer`.
- `src/Envelope.ts` owns the base64url transport codec and envelope composition; `Cipher.Encrypted` owns the decoded byte model.
- `src/internal/cipher.ts` adapts Noble and its CSPRNG to the service contract. Derive nonce/tag sizes from Noble's cipher metadata rather than duplicate them.
- `test/Cipher.test.ts`, `test/Cipher/`, and `test/Envelope.test.ts` exercise these concerns. Fixed public conformance vectors belong in `test/fixtures/`.

Public modules are flat PascalCase files, root namespace exports, and identically cased subpaths. The explicit export allowlist exposes only `.`, `/Cipher`, and `/Envelope`; omitted private paths are inaccessible. `build-utils pack-v3` owns the distribution manifest. Do not hand-edit generated manifests or declarations.

## Modeling and dependencies

Schema owns validated or encoded data, not every TypeScript type. `Cipher.Encrypted` is a schema class with separate nonce and ciphertext fields; `Envelope.Envelope` is its base64url codec. The service describes capabilities without a serialization schema. Cipher failures use `Data.TaggedError`: no current consumer requires their serialization.

Use `Cipher.layer` at application entrypoints. Preserve the `Cipher.Cipher` requirement in intermediate operations; do not install a hidden default backend. Noble-specific types must not leak into public declarations.

The transport codec validates shape and encoding, not authenticity. Cipher decryption checks exact nonce lengths and minimum tag lengths before authentication. All algorithms use 32-byte keys. Rejecting all-zero keys is Theoria policy, not an Effect or AEAD rule. No packed-byte compatibility API is retained.

Consume Effect public APIs throughout callbacks, private code, examples, and tests. `Schema.Uint8Array` validates existing bytes; encoded fixtures and transport use Effect byte codecs. Do not use Schema as an allocation wrapper or introduce text roundtrips for byte manipulation. Keep nonce and ciphertext separate rather than concatenate and split them. Any external operation needs explicit authorization, not an adapter-wide exception.

The explicitly authorized exception is limited to `src/internal/cipher.ts`: Noble's `randomBytes` for cryptographic entropy, and `gcm`, `gcmsiv`, and `xchacha20poly1305` for cipher construction, encryption/decryption, and their nonce/tag metadata. Capture fallible calls with `Effect.try` and preserve typed failures. This authorization does not cover byte helpers, validation, orchestration, or other non-native code in the adapter. Any additional external capability requires separate authorization.

## Reference and verification

Before material changes, inspect version-aligned Effect source, usage, tests, and exports. Schema construction does not copy byte buffers. Production entropy transfers fresh, exclusively owned buffers per execution; private test providers must honor that ownership contract. Keep input bytes stable during operations. Use `Context.Service` and explicit Layers.

Use independent Wycheproof/RFC vectors, seeded `it.effect.prop` laws, failure boundaries, and public composition tests. Only deterministic fixture bytes are seeded; production entropy stays on the host CSPRNG through the Noble adapter. Private entropy injection uses an Effect with a typed failure, including for conformance and cancellation tests; never force a Schema failure to simulate a throwing platform. It is not a public caller-supplied nonce API.

The source manifest and compiler/resolver/build checks own export validation; do not write behavioral tests for file inventories or package metadata. API breaks use a minor Changeset while this package is pre-1.0, with consumer and documentation migration in the same change.
