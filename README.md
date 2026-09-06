# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Theoria is a set of open-source TypeScript libraries for [Effect](https://effect.website) that cover scientific computation, black-box optimization, language model programming, text layout, and cryptography. Each library is published independently under the `@scenesystems` scope, shares one design vocabulary, and is built so that results can be reproduced and their provenance retained.

_Theoria_ (θεωρία) is the Greek word for observation that produces knowledge. The libraries are developed by [Scene Systems](https://scenesystems.io/) and documented at [theoria.scenesystems.io](https://theoria.scenesystems.io/).

## Packages

| Package                                                                   | What it does                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`@scenesystems/effect-math`](./packages/effect-math/README.md)           | Numerics, linear algebra, statistics, probability, and optimization kernels, as pure functions or policy-aware Effects |
| [`@scenesystems/effect-search`](./packages/effect-search/README.md)       | Black-box optimization: TPE, CMA-ES, GP-BO, HyperBand, BOHB, multi-objective search, resumable studies                 |
| [`@scenesystems/effect-dsp`](./packages/effect-dsp/README.md)             | Typed signatures and modules for language model programs, with evaluation, tracing, and prompt optimizers              |
| [`@scenesystems/effect-inference`](./packages/effect-inference/README.md) | Provider-blind model runtime resolution with recorded evidence for every execution                                     |
| [`@scenesystems/effect-text`](./packages/effect-text/README.md)           | Text preparation, measurement services, hyphenation, and greedy multiline layout                                       |
| [`@scenesystems/digest`](./packages/digest/README.md)                     | Content digests over canonical JSON, hashes, MACs, and key derivation                                                  |
| [`@scenesystems/seal`](./packages/seal/README.md)                         | Authenticated encryption with self-describing envelopes                                                                |
| [`@scenesystems/sign`](./packages/sign/README.md)                         | Digital signatures, X25519 key agreement, and XWing post-quantum key encapsulation                                     |

Every package requires Effect `^3.22.1` as a peer dependency. Each README follows the same structure: an overview, installation, a typechecked first example, topic guides, the public surface, and the error and security boundaries you are responsible for.

## Why Theoria

Scene Systems builds tools for creative work whose artifacts must outlive the models, providers, and sessions that produced them. That requirement shaped the libraries in three ways.

Results must be reproducible. Samplers and optimizers draw randomness from seeded generators, numerical policies are explicit values rather than ambient globals, and optimization studies can be snapshotted, persisted, and resumed to the same state.

Evidence must be retained. Model executions record which runtime actually served them, content is identified by canonical digests rather than by location, and signatures and encryption protect what is kept.

Effects must be visible. Pure calculations are plain TypeScript functions. Anything that touches a service, a provider, the clock, or a random source is an Effect with typed errors, so a program's dependencies and failure modes are part of its type.

## How the packages fit together

Arrows point from a package to the packages that depend on it.

```diagram
┌─────────────┐     ┌────────┐
│ effect-math │     │ digest │
└──────┬──────┘     └───┬────┘
       └───────┬────────┘
               ▼
       ┌───────────────┐
       │ effect-search │
       └───┬───────┬───┘
           ▼       ▼
┌────────────┐   ┌─────────────┐
│ effect-dsp │   │ effect-text │
└────────────┘   └─────────────┘
      ▲
      ╎ optional LanguageModel layer
┌──────────────────┐
│ effect-inference │
└──────────────────┘

┌──────┐   ┌──────┐
│ seal │   │ sign │   standalone; pair with digest for key derivation
└──────┘   └──────┘
```

Computation starts with something that can be measured. `effect-math` supplies the numerical operations, either as pure kernels or as validated variants that read runtime policy for precision, backend, and diagnostics.

Once an outcome can be measured it can be searched over. `effect-search` turns any Effect objective into a study: it samples a typed search space, records every trial, supports conditional dimensions and competing objectives, and persists its state so a run can be resumed. It uses `effect-math` for its numerical work and `digest` to key caches and identify artifacts.

The same loop drives language model programs. `effect-dsp` replaces prompt strings with typed signatures and composable modules, evaluates them against examples, and optimizes instructions and demonstrations with algorithms built on `effect-search`. `effect-inference` provides the `LanguageModel` layer, resolving a requested provider through `@effect/ai` and returning evidence about the runtime that answered.

`effect-text` prepares text once and lays it out many times as the available width changes. It stands apart from the data pipeline, but its experimental calibration tools use `effect-math` and `effect-search` to fit layout profiles against measured samples.

When a result is kept, `digest` gives its exact content a stable name, `sign` binds it to a key, and `seal` encrypts it. The three cryptography packages share one contract: a single entrypoint, Effect-typed errors that carry no secret material, conformance to published standards, and clear statements of what the application must still provide.

## Getting started

Install the package you need together with Effect. This example minimizes a function without a gradient using `effect-search`:

```sh
npm install @scenesystems/effect-search effect @effect/platform @effect/experimental
```

```ts typecheck
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  return yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: ({ x, y }) => Effect.succeed((x - 2) ** 2 + (y + 1) ** 2),
    trials: 50
  })
})

Effect.runPromise(program)
```

The objective is an ordinary Effect, so it can run a benchmark, call a model, or use any service in your program. The fixed seed makes the study reproducible. Each package README opens with a comparable first example and continues with topic guides; each `packages/<name>/examples/` directory holds runnable programs you can execute with `bun run`.

## Documentation

- [theoria.scenesystems.io](https://theoria.scenesystems.io/) presents the packages with guides and a generated API reference.
- Each package README in [`packages/`](./packages/) is the source of those guides and works standalone on npm and GitHub.
- Every package ships TSDoc on its public exports and a `CHANGELOG.md` maintained through [Changesets](https://github.com/changesets/changesets).

## Research and acknowledgements

Theoria implements published algorithms and builds on open-source work. The references below are the ones each package follows most closely; each package README credits its sources in an Attribution or Standards section.

**Effect.** All packages are built on [Effect](https://github.com/Effect-TS/effect) for services, resources, typed errors, and schemas, and the model packages use [`@effect/ai`](https://effect.website/docs/ai/introduction/) for provider integration.

**Black-box optimization (`effect-search`).** Sampler behavior and numerical fixtures draw on [Optuna](https://github.com/optuna/optuna) ([Akiba et al., 2019](https://arxiv.org/abs/1907.10902)). The algorithms follow the Tree-structured Parzen Estimator ([Bergstra et al., 2011](https://papers.nips.cc/paper/4443-algorithms-for-hyper-parameter-optimization)), multi-objective TPE ([Ozaki et al., 2022](https://doi.org/10.1613/jair.1.13188)), constrained TPE ([Watanabe and Hutter, 2023](https://arxiv.org/abs/2211.14411)), HyperBand ([Li et al., 2018](https://arxiv.org/abs/1603.06560)), BOHB ([Falkner et al., 2018](https://arxiv.org/abs/1807.01774)), and CMA-ES ([Hansen, 2016](https://arxiv.org/abs/1604.00772)).

**Language model programs (`effect-dsp`).** The programming model comes from [DSPy](https://github.com/stanfordnlp/dspy) and [Khattab et al., 2023](https://arxiv.org/abs/2310.03714). MIPROv2 follows [Opsahl-Ong et al., 2024](https://arxiv.org/abs/2406.11695) and GEPA follows [Agrawal et al., 2025](https://arxiv.org/abs/2507.19457).

**Numerics (`effect-math`).** Results are checked against [SciPy](https://scipy.org/) and [NumPy](https://numpy.org/) reference values. Implementations use established methods including the Lanczos gamma approximation, Cephes error-function coefficients, Kahan compensated summation, golden-section search, and complex-step differentiation; incorporated coefficient tables from [Boost.Math](https://www.boost.org/doc/libs/release/libs/math/) are listed in the package's [third-party notices](./packages/effect-math/THIRD_PARTY_NOTICES).

**Text layout (`effect-text`).** The separation of effectful preparation from pure layout is inspired by [pretext](https://github.com/chenglou/pretext).

**Cryptography (`digest`, `seal`, `sign`).** Primitives come from Paul Miller's audited [noble](https://paulmillr.com/noble/) libraries: [noble-hashes](https://github.com/paulmillr/noble-hashes), [noble-ciphers](https://github.com/paulmillr/noble-ciphers), [noble-curves](https://github.com/paulmillr/noble-curves), and [noble-post-quantum](https://github.com/paulmillr/noble-post-quantum). Canonicalization follows [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) and hashing follows the [BLAKE3](https://github.com/BLAKE3-team/BLAKE3-specs) and [FIPS 180-4](https://doi.org/10.6028/NIST.FIPS.180-4) specifications. Encryption follows [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439), [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452), and [NIST SP 800-38D](https://doi.org/10.6028/NIST.SP.800-38D). Signatures and key exchange follow [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032), [RFC 7748](https://www.rfc-editor.org/rfc/rfc7748), [FIPS 203](https://doi.org/10.6028/NIST.FIPS.203), [FIPS 204](https://doi.org/10.6028/NIST.FIPS.204), [FIPS 205](https://doi.org/10.6028/NIST.FIPS.205), and the [X-Wing specification](https://doi.org/10.62056/a3qj89n4e). Test suites check published vectors, including those from [Project Wycheproof](https://github.com/C2SP/wycheproof).

## Development

The repository is a [Bun](https://bun.sh) workspace. Clone it, install dependencies, and run the checks:

```sh
bun install
bun run check      # type check every package
bun run lint       # oxlint + eslint + dprint
bun run test       # vitest
bun run build      # build every package
```

Scope a command to one package with `bun run --filter @scenesystems/effect-search test`. Package source lives in `packages/<name>/src`, tests in `packages/<name>/test`, and runnable programs in `packages/<name>/examples`. The documentation site lives in [`apps/theoria`](./apps/theoria/README.md) and is generated from the package READMEs and TSDoc.

## Status and versioning

Theoria is in active development. Packages are versioned independently and are pre-1.0, so a minor release may change a public API, and modules marked `Experimental` may change with less notice. Pin a compatible version and read the package changelog when upgrading. Releases are published to npm with provenance attestations from this repository.

## Contributing and support

Read the [contributing guide](./CONTRIBUTING.md) before opening a pull request. Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for questions, defects, and proposals. Report vulnerabilities privately through the [security policy](./SECURITY.md). Participation is governed by the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
