---
description: Development guidelines for @scenesystems/sign
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/sign

Effect-native signatures, key agreement, encapsulation, and JWT verification.

## Design and ownership

- Design representative imports and call sites before changing a concern. Use version-aligned Effect public declarations, implementations, tests, usage, and exports as the architectural reference.
- Public concerns live in flat PascalCase modules; root namespace and exact-case package subpath expose the same canonical declarations. The explicit export allowlist omits private and obsolete paths. This package is no longer single-entrypoint.
- Suite modules own operations and suite-specific models/errors. `Signature` owns signature carriers and signing failures; `KeyPair` owns common keys and generation failures; `Verification` owns strict-verifier resource policy and material-free errors.
- There is no generic algorithm dispatcher, self-trusting signature verifier, separate schemas directory, or compatibility alias surface. Related variants remain together, such as the parameter sets in `MlDsa` and `SlhDsa`.
- Small coherent implementations may stay public. Substantial private mechanics belong in camelCase files under `internal/`; private code must not redefine public models or leak Noble types into public declarations.
- Models with codec semantics use Schema; capabilities use Context and Layers. Schema is not required for every TypeScript relationship. This corrects the former local blanket rule; Effect also uses Data values and type-only declarations.
- Semantic roles determine casing. Constants are not automatically UPPER_SNAKE_CASE. Use qualified schema identifiers, brands, and service keys; preserve compatibility-sensitive wire tags independently of local names.
- `index.ts` is maintained with the explicit source export map. The existing build-utils `pack-v3` workflow generates distribution manifests; do not hand-edit those outputs.

## Cryptographic contracts

- Preserve standards, strict admission, canonical encodings, context binding, input snapshots, and error-channel distinctions. The strict verifier's 8,192-byte message bound is Theoria resource policy, not an Effect convention or cryptographic standard.
- Output-determining randomness comes from `Entropy.Entropy`. Provide `Entropy.layer` at application boundaries, never inside library operations. Effect Random is unsuitable for secrets. Deterministic replacements are test-only.
- Preserve Noble's independent scalar/inversion blinding. Explicit key/signature entropy does not mean the primitive performs no ambient RNG calls.
- Derivation, deterministic signing, verification, agreement, and decapsulation must not acquire fictitious entropy requirements. Caller-hedged ML-DSA-65 takes explicit context and 32 fresh entropy bytes.
- Authenticate keys and protocol framing outside the primitive. X25519 and X-Wing return raw secrets requiring a protocol-specific KDF. Signature carriers do not establish identity.
- Strict errors retain no material. Other errors may contain diagnostics; document disclosure policy. Secret storage, redaction, and destruction remain explicit application responsibilities.
- Noble audits do not cover Theoria's custom RSA scheme composition.

## Tests and checks

Use package-local `test/Concern.test.ts` and `test/Concern/behavior.test.ts`, with public imports for public guarantees. Test private algorithms directly only for focused laws. Drive behavioral changes red → green → refactor using `@effect/vitest`.

Use independent RFC/ACVP/Wycheproof/OpenSSL vectors, asymmetric inputs, admission boundaries, and seeded property-based laws. Round trips alone are not conformance. Do not add file/export/metadata inventory tests; compiler, resolver, docs, and build own structural checks.

Run the root four gates: `bun run check:all && bun run lint && bun run test && bun run build`. Also run `bun run --filter @scenesystems/sign fixtures:check` and, after building, `bun run --filter @scenesystems/sign test:packed`. The packed check installs a tarball in an isolated scoped directory and exercises public APIs in Bun and native workerd. Fixture payloads and fingerprints under `test/fixtures/conformance/` change only through their documented generation workflow.

Public declarations need a purpose, `@since`, `@category`, and precise representation, failure, dependency, and security contracts. Module headers need `@module`. Keep README and examples aligned and compile them through the repository's documentation workflow. Breaking pre-1.0 API changes use a minor Changeset; do not silently add aliases.
