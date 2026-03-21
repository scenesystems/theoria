# Theoria

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect-native scientific computing for TypeScript.

_Theoria_ (θεωρία) — the disciplined act of observation that produces knowledge. These packages implement that discipline computationally: search algorithms that learn from what they observe, programs that optimize themselves through structured evaluation, and the mathematical foundations both depend on.

Built on [Effect](https://effect.website).

## Packages

| Package         | Description                                                                                                                                                                                                        |                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `effect-search` | Bayesian optimization for TypeScript. TPE, MOTPE, HyperBand/BOHB, constrained c-TPE, typed search spaces, snapshot/resume, streaming events. Verified against [Optuna](https://github.com/optuna/optuna).          | [README](./packages/effect-search/README.md) |
| `effect-dsp`    | Programming — not prompting — language models. A ground-up Effect-native implementation of the [DSPy](https://dspy.ai/) paradigm. Typed signatures, learnable modules, fiber-scoped traces, six prompt optimizers. | [README](./packages/effect-dsp/README.md)    |
| `effect-math`   | Mathematical and statistical foundations — an independent mathematical substrate organized by domain, not an extraction from existing packages.                                                                    | _planned_                                    |

`effect-dsp` depends on `effect-search` for optimizer orchestration. `effect-math` will provide shared mathematical primitives for both.

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
bun --filter effect-search run check
bun --filter effect-search run test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## Acknowledgments

`effect-search` builds on [Bergstra et al. (2011)](https://papers.nips.cc/paper/2011/hash/86e8f7ab32cfd12577bc2619bc635690-Abstract.html), [Watanabe (2023)](https://arxiv.org/abs/2304.11127), [Ozaki et al. (2022)](https://doi.org/10.1613/jair.1.13188), [Li et al. (2017)](https://jmlr.org/papers/v18/16-558.html), and [Falkner et al. (2018)](https://proceedings.mlr.press/v80/falkner18a.html), verified against [Optuna](https://github.com/optuna/optuna).

`effect-dsp` implements [DSPy (Khattab et al., 2023)](https://arxiv.org/abs/2310.03714) with optimizers from [MIPROv2 (Opsahl-Ong et al., 2024)](https://arxiv.org/abs/2406.11695) and [GEPA (Agrawal et al., 2025)](https://arxiv.org/abs/2507.19457).

Built on [Effect](https://effect.website).

## Status

Early alpha. These packages are being ported from [Scene Systems](https://github.com/scenesystems)' internal research infrastructure into standalone open-source packages. APIs may change.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
