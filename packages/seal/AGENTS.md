---
description: Development guidelines for @scenesystems/seal
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/seal

Authenticated encryption for Effect. Follow the root four-gate workflow.

## Concern ownership

- `src/Cipher.ts` owns the algorithm schema/type, key policy, failures, backend Context service, operations, and `layer`.
- `src/Envelope.ts` owns the schema class, JSON representation, byte conversions, and envelope composition.
- `src/internal/cipher.ts` adapts Noble and its CSPRNG to the service contract. Derive nonce/tag sizes from Noble's cipher metadata rather than duplicate them.
- `test/Cipher.test.ts`, `test/Cipher/`, and `test/Envelope.test.ts` exercise these concerns. Fixed public conformance vectors belong in `test/fixtures/`.

Public modules are flat PascalCase files, root namespace exports, and identically cased subpaths. The explicit export allowlist exposes only `.`, `/Cipher`, and `/Envelope`; omitted private paths are inaccessible. `build-utils pack-v3` owns the distribution manifest. Do not hand-edit generated manifests or declarations.

## Modeling and dependencies

Schema owns validated or encoded data, not every TypeScript type. `Envelope.Envelope` is a schema class; `Cipher.Algorithm` is a literal schema and derived type. The service describes capabilities without a serialization schema. Cipher failures use `Data.TaggedError`: no current consumer requires their serialization. Do not retain a codec solely because a previous API had one.

Use `Cipher.layer` at application entrypoints. Preserve the `Cipher.Cipher` requirement in intermediate operations; do not install a hidden default backend. Noble-specific types must not leak into public declarations.

The JSON schema validates shape, not authenticity. Byte conversion checks base64url and separate field lengths; decryption authenticates. All algorithms use 32-byte keys. Rejecting all-zero keys is Theoria policy, not an Effect or AEAD rule. Protocol guarantees inform API design; historical declarations and layouts do not constrain it.

Consume Effect's public APIs throughout callbacks, private code, examples, and tests. Use `Array` and `Schema.Uint8Array` for byte representation changes, `Number` for arithmetic/comparison, and `Effect`/`Either` for validation. Upstream implementation syntax is not an exemption. Effect 3.22.1 and Platform 0.97.1 have no secure-random-byte or AEAD service; any external operation needs explicit authorization under the native-Effect mandate, not an adapter-wide exception.

The explicitly authorized exception is limited to `src/internal/cipher.ts`: Noble's `randomBytes` for cryptographic entropy, and `gcm`, `gcmsiv`, and `xchacha20poly1305` for cipher construction, encryption/decryption, and their nonce/tag metadata. Capture fallible calls with `Effect.try` and preserve typed failures. This authorization does not cover byte helpers, validation, orchestration, or other non-native code in the adapter. Any additional external capability requires separate authorization.

## Reference and verification

Before material changes, inspect version-aligned Effect source, usage, tests, and exports. Effect 3.22.1 uses namespace modules, Context tags, and Layers; `Schema.Class` validates construction and extends Data.Class. Effect does not universally require schemas for services or UPPER_SNAKE_CASE for constants. Those older statements in this package's guidance were incorrect.

Use independent Wycheproof/RFC vectors, seeded `it.effect.prop` laws, failure boundaries, and public composition tests. Only deterministic fixture bytes are seeded; production entropy stays on the host CSPRNG through the Noble adapter. Private entropy injection uses an Effect with a typed failure, including for conformance and cancellation tests; never force a Schema failure to simulate a throwing platform. It is not a public caller-supplied nonce API.

The source manifest and compiler/resolver/build checks own export validation; do not write behavioral tests for file inventories or package metadata. API breaks use a minor Changeset while this package is pre-1.0, with consumer and documentation migration in the same change.
