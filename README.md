# Theoria

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect-native libraries for applied math, optimization, language model
programming, text layout, and cryptography.

_Theoria_ (θεωρία) — observation that produces knowledge.

[Package Map](#package-map) · [Theoria App](#theoria-app) ·
[Development](#development) · [Contributing](./CONTRIBUTING.md) ·
[Security](./SECURITY.md)

## Package Map

| Package                                           | Focus                                                                                      | Docs                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [`effect-math`](./packages/effect-math)           | Numerics, linear algebra, statistics, probability, special functions, optimization kernels | [README](./packages/effect-math/README.md)      |
| [`effect-search`](./packages/effect-search)       | Typed search spaces, Bayesian optimization, studies, snapshots, replay                     | [README](./packages/effect-search/README.md)    |
| [`effect-dsp`](./packages/effect-dsp)             | Effect-native DSPy-style language model programming                                        | [README](./packages/effect-dsp/README.md)       |
| [`effect-text`](./packages/effect-text)           | Effectful text preparation and pure multiline layout                                       | [README](./packages/effect-text/README.md)      |
| [`effect-inference`](./packages/effect-inference) | Provider-blind runtime descriptors, route resolution, and replay-safe runtime evidence     | [README](./packages/effect-inference/README.md) |
| [`@scenesystems/digest`](./packages/digest)       | Hashing, HMAC, HKDF, JCS canonicalization                                                  | [README](./packages/digest/README.md)           |
| [`@scenesystems/seal`](./packages/seal)           | Authenticated encryption and self-describing envelopes                                     | [README](./packages/seal/README.md)             |
| [`@scenesystems/sign`](./packages/sign)           | Signatures, key exchange, and KEMs                                                         | [README](./packages/sign/README.md)             |

Workspace relationships stay explicit:

- `effect-search` depends on `effect-math` and `@scenesystems/digest`.
- `effect-dsp` depends on `effect-search`, `effect-math`, and `@scenesystems/digest`.
- `effect-text` depends on `effect-search` and `effect-math`, while still owning a separate prepare/layout runtime lane.
- `effect-inference` owns provider-blind runtime descriptors and route resolution, while `effect-dsp`, `effect-search`, and `apps/theoria` consume that substrate without re-hosting provider clients.
- `@scenesystems/digest`, `@scenesystems/seal`, and `@scenesystems/sign` are standalone single-entrypoint crypto packages.

## Theoria App

[`apps/theoria/`](./apps/theoria/) is the proving consumer for the published
packages. It exposes live, typed demos for `effect-text`, `effect-search`,
`effect-math`, and `effect-dsp`.

```sh
bun run app:theoria
```

Open `http://127.0.0.1:3876`.

For the tmux workflow and route-level app guidance, see
[`apps/theoria/README.md`](./apps/theoria/README.md).

## Development

Requires [bun](https://bun.sh) `>= 1.3`.

```sh
bun install
bun run check
bun run check:tests
bun run check:readmes
bun run lint
bun run test
bun run build
```

Run one package at a time with Bun filters:

```sh
bun run --filter effect-text test
bun run --filter effect-search build
bun run --filter @scenesystems/digest test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and repository rules.

## Notes

The monorepo is built on [Effect](https://effect.website). The crypto packages
build on the [Noble](https://paulmillr.com/noble/) ecosystem. Package-specific
algorithm references, prior art, and third-party notices live in the
individual package READMEs and notice files rather than being duplicated here.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
