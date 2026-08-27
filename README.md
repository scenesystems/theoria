# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

**Scientific computing, model programming, text layout, and cryptography for
[Effect](https://effect.website).**

Theoria is Scene Systems' open-source TypeScript package set. Its libraries
measure outcomes, search alternatives, define and evaluate model programs,
record which runtime produced a result, prepare text, and identify, sign, or
encrypt artifacts.

_Theoria_ (θεωρία) is Greek for observation that produces knowledge.

[Explore the live examples](https://theoria.scenesystems.io/) or [read how the
packages compose](#how-the-pieces-fit).

## Why Theoria exists

[Scene Systems](https://scenesystems.io/) turns imagination into shared
reality. Scene is organized around Worlds: persistent places, stories, tools,
communities, theories, or possible futures. People and machines can create,
enter, extend, branch, and merge them. Each World retains its founding intent,
participants, history, alternatives, authorship, decisions, and open
possibilities.

Persistent Worlds must remain understandable as contributors, models, and
runtimes change. This requires explicit uncertainty in measurements,
reproducible experiment histories, program and runtime records for model
outputs, stable artifact identity, authorship records, and encryption for
private material. Theoria provides these capabilities as general-purpose
libraries.

The packages use [Effect](https://effect.website) to represent expected
failures, required services, concurrency, interruption, and resource lifetimes.
Pure calculations remain ordinary functions; runtime policies and external
services use typed Effect programs.

## How the pieces fit

The packages compose across five parts of computational work: measurement,
search, model programming, text presentation, and artifact protection. Each can
also be used independently.

### Measure outcomes

[`@scenesystems/effect-math`](./packages/effect-math/README.md) supplies the
numerical foundation: linear algebra, calculus, geometry, probability,
statistics, distributions, special functions, and optimization. It includes
pure kernels and policy-aware operations with typed domain failures, runtime
precision policies, and diagnostics.

### Explore alternatives

[`@scenesystems/effect-search`](./packages/effect-search/README.md) performs
black-box optimization when configurations can be evaluated but no direct
solution is available. It supports continuous, integer, categorical,
conditional, and multi-objective spaces with reproducible samplers, budgets,
constraints, persistence, and resume.

A multi-objective study can preserve fast, inexpensive, and high-quality model
programs on one Pareto frontier. `effect-search` uses `effect-math` for
numerical operations and [`digest`](./packages/digest/README.md) for stable
cache and artifact identities.

### Program and account for models

[`@scenesystems/effect-dsp`](./packages/effect-dsp/README.md) defines language
model programs with typed signatures, composable modules, evaluation, tracing,
and optimizers for instructions and examples. Its optimization layer composes
`effect-search`, `effect-math`, and `digest`.

[`@scenesystems/effect-inference`](./packages/effect-inference/README.md)
describes where model work runs. It records the requested runtime, the resolved
provider route, and the execution evidence returned after a text or embedding
call.

Both packages use `@effect/ai`. A DSP program remains provider-independent,
while inference evidence records the runtime that produced each result.

### Prepare language for changing interfaces

[`@scenesystems/effect-text`](./packages/effect-text/README.md) prepares,
measures, and lays out multiline text. It performs segmentation, measurement,
and caching before layout, then reuses the prepared text for pure projections
across changes in width, obstacles, or presentation.

Preparation and layout do not invoke search. Experimental calibration tools use
`effect-search` and `effect-math` to tune layout behavior against measured
examples.

### Preserve identity, authorship, and privacy

The cryptographic packages provide separate mechanisms for content identity,
authenticity, and confidentiality:

- [`@scenesystems/digest`](./packages/digest/README.md) provides strict JSON
  canonicalization, BLAKE3 and SHA-256 content identities, HMAC, and HKDF. A
  digest identifies exact content without assigning application semantics.
- [`@scenesystems/sign`](./packages/sign/README.md) provides classical and
  post-quantum signatures, direct verification, key agreement, and hybrid key
  encapsulation. These primitives support attribution and authenticity;
  applications retain responsibility for identity and authorization.
- [`@scenesystems/seal`](./packages/seal/README.md) protects private material
  with authenticated encryption and self-describing XChaCha20-Poly1305 or AES
  envelopes.

## The relationship to Scene

Scene is the product; Theoria publishes general-purpose computational libraries
developed alongside it. Scene currently uses `digest` for content identity,
`sign` for cryptographic evidence, and `effect-math` in its visual system. The
package set is not currently an integrated Scene runtime.

The scientific and model-programming packages develop foundations for
measurement, comparison, reproducibility, provenance, and improvement in
persistent Worlds. The World model and Scene application live outside this
repository.

## Try a package

Every library is published independently under the `@scenesystems` scope. This
`effect-search` program minimizes a function without a gradient:

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

The objective accepts any Effect, including a calculation, benchmark, model
call, or service request. A fixed seed makes the search reproducible. Each
package README contains installation instructions, runnable examples, an API
guide, and stability notes.

## Theoria app

[theoria.scenesystems.io](https://theoria.scenesystems.io/) runs the public
package APIs and displays their typed inputs, results, failures, and runtime
evidence. The math, search, and text examples require no external provider. The
model programming example requires a configured provider.

The app source and local setup live in
[`apps/theoria`](./apps/theoria/README.md).

## Status

Theoria is in active development. All packages are independently versioned and
pre-1.0; public APIs may change between minor releases. They require Effect
`^3.22.1`. Package READMEs and changelogs document other peer dependencies and
stability notes.

## Contributing and support

Read the [contribution guide](./CONTRIBUTING.md) before opening a pull request.
Use the [issue tracker](https://github.com/scenesystems/theoria/issues) for bugs,
questions, and focused improvements. Report vulnerabilities through the
[security policy](./SECURITY.md).

Participation in the project is governed by the
[Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
