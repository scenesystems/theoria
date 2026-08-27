# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Theoria is a collection of open-source TypeScript libraries developed by Scene
Systems for [Effect](https://effect.website). The libraries support scientific
calculation and model programming, then preserve enough evidence to reproduce
their results. The collection also includes text layout and cryptographic
operations for applications that retain those results.

_Theoria_ (θεωρία) is Greek for observation that produces knowledge. [The
site](https://theoria.scenesystems.io/) introduces the packages and links to
their published modules and source.

## Purpose

[Scene Systems](https://scenesystems.io/) is building Scene to turn imagination
into shared reality. A creation in Scene is a World. It can begin as a story and
grow into something people intend to make real. People and machines can extend
a World without erasing where it came from. Branching preserves alternatives,
and merging preserves the lineages they combine.

A World may outlive the model or provider that helped create it. Its history
must still explain how an artifact was produced and why one version was chosen
over another. Contributions need durable attribution, and private work must
remain private until its authors choose to share it.

Theoria develops reusable libraries for this computational work. Effect
supplies the runtime for service dependencies and resource lifetimes. Pure
calculations remain plain TypeScript functions.

## Package relationships

Computational work begins with something that can be measured.
[`@scenesystems/effect-math`](./packages/effect-math/README.md) provides the
numerical operations needed to express that measurement. Its pure kernels can
be called directly. Policy-aware variants add an Effect error channel and read
runtime policy when the calculation requires it.

Once an outcome can be measured, it can guide a search.
[`@scenesystems/effect-search`](./packages/effect-search/README.md) turns an
Effect objective into a reproducible study. A study can explore parameters that
change conditionally and preserve a Pareto frontier when objectives compete.
Its state can be saved and resumed. It uses `effect-math` for its numerical work
and [`@scenesystems/digest`](./packages/digest/README.md) to identify cached
inputs and study artifacts.

The same evaluation loop applies to language model programs.
[`@scenesystems/effect-dsp`](./packages/effect-dsp/README.md) replaces loose
prompt strings with typed signatures and executable modules. Traces from those
modules feed evaluation, and the resulting scores drive optimizers built on
`effect-search`. Instructions and examples become parameters of a program whose
behavior can be tested and revised.

[`@scenesystems/effect-inference`](./packages/effect-inference/README.md) records
the execution behind each model result. It follows a requested runtime through
provider resolution and records the response metadata. Both model libraries use
`@effect/ai`. A DSP program can use different providers while retaining
provenance for each execution.

Text enters an interface through
[`@scenesystems/effect-text`](./packages/effect-text/README.md), which resolves
the external work of segmenting and measuring text once. It returns a prepared
value that can be laid out repeatedly as the available space changes. Its
experimental calibration tools use `effect-math` and `effect-search` to compare
layout profiles against measured examples.

When a result is retained, [`@scenesystems/digest`](./packages/digest/README.md)
gives its exact content a stable name by canonicalizing structured data and
hashing the resulting bytes. [`@scenesystems/sign`](./packages/sign/README.md)
can authenticate that content against an independently supplied key; the
calling application remains responsible for identity and authorization.
Private material can be encrypted with
[`@scenesystems/seal`](./packages/seal/README.md), which stores authenticated
ciphertext in a self-describing envelope.

## Try a package

Each library is published independently under the `@scenesystems` scope. This
example uses `effect-search` to minimize a function without a gradient:

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

The objective can perform any Effect. Here it is a local calculation; it could
also run a benchmark or call a model. The fixed seed makes the study
reproducible. Each package README explains how to install and use the library
and states the API's current stability.

## Theoria site

[theoria.scenesystems.io](https://theoria.scenesystems.io/) presents the package
collection and its relationship to reproducible computational work.

The app source and local setup live in
[`apps/theoria`](./apps/theoria/README.md).

## Status

Theoria is in active development. Its packages are independently versioned and
remain pre-1.0, so public APIs may change between minor releases. They require
Effect `^3.22.1`; other peer dependencies and stability notes are documented by
each package.

## Contributing and support

Read the [contribution guide](./CONTRIBUTING.md) before opening a pull request.
Use the [issue tracker](https://github.com/scenesystems/theoria/issues) for
support and proposed changes. Report vulnerabilities through the [security
policy](./SECURITY.md).

Participation in the project is governed by the
[Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE). Copyright © 2026 Scene Systems
