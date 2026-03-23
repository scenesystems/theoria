# Theoria

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Open-source Effect-native infrastructure for TypeScript.

_Theoria_ (θεωρία) — the disciplined act of observation that produces knowledge. These packages provide the computational foundations for systems that learn, optimize, reason, and verify: search algorithms that improve from what they observe, programs that optimize themselves through structured evaluation, cryptographic primitives that establish trust, and the mathematical substrate everything builds on.

Built on [Effect](https://effect.website).

## Packages

| Package                | Description                                                                                                                                                                                                        |                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `effect-search`        | Bayesian optimization for TypeScript. TPE, MOTPE, HyperBand/BOHB, constrained c-TPE, typed search spaces, snapshot/resume, streaming events. Verified against [Optuna](https://github.com/optuna/optuna).          | [README](./packages/effect-search/README.md) |
| `effect-dsp`           | Programming — not prompting — language models. A ground-up Effect-native implementation of the [DSPy](https://dspy.ai/) paradigm. Typed signatures, learnable modules, fiber-scoped traces, six prompt optimizers. | [README](./packages/effect-dsp/README.md)    |
| `effect-math`          | Mathematical and statistical foundations — numerics, linear algebra, probability, optimization, and more. Organized by domain with branded scalars, typed errors, and configurable runtime policies.               | [README](./packages/effect-math/README.md)   |
| `@scenesystems/digest` | Content hashing and JCS canonicalization. BLAKE3-256, SHA-256, HMAC, HKDF, RFC 8785. Schema-typed, branded types, typed errors.                                                                                    | [README](./packages/digest/README.md)        |
| `@scenesystems/seal`   | Authenticated encryption. XChaCha20-Poly1305, AES-256-GCM-SIV, AES-256-GCM. Schema-typed sealed envelopes, typed errors.                                                                                           | [README](./packages/seal/README.md)          |
| `@scenesystems/sign`   | Digital signatures, key agreement, and key encapsulation. Ed25519, secp256k1, X25519, ML-DSA, SLH-DSA, XWing hybrid post-quantum. Schema-typed, typed errors.                                                      | [README](./packages/sign/README.md)          |

`effect-dsp` depends on `effect-search` for optimizer orchestration. `effect-math` provides shared mathematical primitives. The `@scenesystems/*` cryptographic packages provide content hashing, authenticated encryption, and digital signatures — built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem (6 audits by Cure53 and Trail of Bits). All packages are Effect-native with Schema as the single source of truth for types.

## Development

Requires [bun](https://bun.sh) ≥ 1.3.

```sh
bun install
bun run check
bun run test
bun run lint
bun run build
```

Per-package:

```sh
bun run --filter effect-search check
bun run --filter effect-search test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Acknowledgments

### Optimization — `effect-search`

The TPE sampler implements [Bergstra et al. (2011)](https://papers.nips.cc/paper/2011/hash/86e8f7ab32cfd12577bc2619bc635690-Abstract.html) with bandwidth selection and weighting from [Watanabe (2023)](https://arxiv.org/abs/2304.11127). Multi-objective MOTPE follows [Ozaki et al. (2022)](https://doi.org/10.1613/jair.1.13188) with hypervolume contribution weighting from [Guerreiro et al. (2021)](https://doi.org/10.1145/3453474). Constrained c-TPE follows [Watanabe & Hutter (2023)](https://doi.org/10.24963/ijcai.2023/486). HyperBand scheduling follows [Li et al. (2017)](https://jmlr.org/papers/v18/16-558.html), with BOHB combining it with TPE per [Falkner et al. (2018)](https://proceedings.mlr.press/v80/falkner18a.html). Verified against [Optuna](https://github.com/optuna/optuna).

### Language model programming — `effect-dsp`

Implements the [DSPy](https://github.com/stanfordnlp/dspy) paradigm introduced by [Khattab et al. (2023)](https://arxiv.org/abs/2310.03714), building on the original DSP framework [(Khattab et al., 2022)](https://arxiv.org/abs/2212.14024). Optimizers from [MIPROv2 (Opsahl-Ong et al., 2024)](https://arxiv.org/abs/2406.11695), [GEPA (Agrawal et al., 2025)](https://arxiv.org/abs/2507.19457), and [BootstrapFinetune / BetterTogether (Khattab et al., 2024)](https://arxiv.org/abs/2407.10930).

### Cryptography — `@scenesystems/*`

Built on the [Noble](https://paulmillr.com/noble/) audited cryptographic ecosystem (6 audits by [Cure53](https://cure53.de/) and [Trail of Bits](https://www.trailofbits.com/)): [@noble/hashes](https://github.com/paulmillr/noble-hashes), [@noble/ciphers](https://github.com/paulmillr/noble-ciphers), [@noble/curves](https://github.com/paulmillr/noble-curves), [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum).

### Foundation

Built on [Effect](https://effect.website).

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
