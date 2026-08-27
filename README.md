# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Scientific computing, model programming, text layout, and cryptography for
[Effect](https://effect.website).

Theoria is a family of TypeScript libraries for work that begins with data and
ends in a decision: calculate a distribution, search for a better
configuration, define and improve a language-model program, lay out text, or
protect the result cryptographically.

These jobs often end up in separate libraries with different rules for
failures, dependencies, concurrency, and reproducibility. Theoria gives them a
common home in Effect. Computation that can stay pure does; work involving
policies, resources, or external services becomes a typed Effect workflow.

_Theoria_ (θεωρία) means observation that produces knowledge.

[Explore the live examples](https://theoria.scenesystems.io/) or start with one
of the packages below.

## Get started

Each package is published independently under the `@scenesystems` scope, so
you can install only the part you need. For example, this small
`effect-search` program looks for the minimum of a function without requiring
a gradient:

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

The objective can be any Effect: a local calculation, a benchmark, a model
call, or a request to another service. The seed makes the search reproducible.

## Choose a package

The packages share conventions, but they are not one large framework. Start
with the package that owns your problem and add another only when the work
crosses that boundary.

### Compute and optimize

| Package                                               | Use it for                                                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`effect-math`](./packages/effect-math/README.md)     | Numerics, linear algebra, calculus, probability, statistics, distributions, and optimization kernels, with pure and policy-aware APIs. |
| [`effect-search`](./packages/effect-search/README.md) | Reproducible black-box optimization over continuous, integer, categorical, conditional, or multi-objective search spaces.              |

`effect-search` builds on `effect-math` for computation and `digest` for stable
content identity. Use `effect-math` directly when you know the calculation;
use `effect-search` when you can measure an outcome but cannot derive the best
configuration analytically.

### Work with models and text

| Package                                                     | Use it for                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`effect-inference`](./packages/effect-inference/README.md) | Connecting `@effect/ai` text and embedding workloads to provider runtimes while keeping route selection and execution evidence explicit.            |
| [`effect-dsp`](./packages/effect-dsp/README.md)             | Defining language-model programs with typed signatures, reusable modules, evaluation, tracing, and prompt optimizers inspired by DSPy.              |
| [`effect-text`](./packages/effect-text/README.md)           | Preparing, measuring, and laying out multiline text so the expensive preparation step can be reused when width, obstacles, or presentation changes. |

`effect-inference` deals with where a model runs; `effect-dsp` deals with what
the model program does and how it improves. They meet at `@effect/ai`, which
keeps a DSP program independent of a particular provider. `effect-dsp` uses
`effect-search`, `effect-math`, and `digest` for optimization and reproducible
artifacts.

The main `effect-text` prepare-and-layout path is separate from model
programming. Its experimental calibration tools use `effect-search` and
`effect-math` to tune layout behavior against measured data.

### Protect and identify data

| Package                                 | Use it for                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`digest`](./packages/digest/README.md) | Strict JSON canonicalization, content hashing, HMAC, and key derivation. It also supplies stable identities to `effect-search` and `effect-dsp`. |
| [`seal`](./packages/seal/README.md)     | Authenticated encryption with self-describing XChaCha20-Poly1305 and AES envelopes.                                                              |
| [`sign`](./packages/sign/README.md)     | Classical and post-quantum signatures, X25519 key agreement, and hybrid key encapsulation.                                                       |

These cryptographic packages can be used on their own. They expose
Effect-native errors and schemas while keeping the underlying Noble
implementations behind package-owned APIs.

## Theoria app

[theoria.scenesystems.io](https://theoria.scenesystems.io/) is a working tour
of the libraries rather than a separate product API. Its demos execute the
same package surfaces available to consumers and show their typed inputs,
results, failures, and runtime evidence.

The app source and local setup live in
[`apps/theoria`](./apps/theoria/README.md).

## Status

Theoria is in active development. The packages are versioned independently and
are currently pre-1.0, so public APIs may change between minor releases. The
current releases target Effect 3.22.1 and compatible Effect 3 releases; see
each package README and changelog for its exact peer dependencies and stability
notes.

## Contributing and support

Bug reports, focused improvements, documentation fixes, and new use cases are
welcome. Read the [contribution guide](./CONTRIBUTING.md) before opening a pull
request. Please use the [issue tracker](https://github.com/scenesystems/theoria/issues)
for questions and bugs, and follow the [security policy](./SECURITY.md) when a
report may involve a vulnerability.

Participation in the project is governed by the
[Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
