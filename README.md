# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Theoria is an open-source collection of TypeScript libraries built with [Effect](https://effect.website). The packages cover scientific computation and optimization, language-model programming, text layout, and cryptography. Each is published independently under `@scenesystems` and requires Effect `^4.0.0`.

Start with the [documentation](https://theoria.scenesystems.io/docs) or a package README below. The libraries are developed by [Scene Systems](https://scenesystems.io/).

## Choose a package

| Package                                                                   | Use it for                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`@scenesystems/effect-math`](./packages/effect-math/README.md)           | Numerics, linear algebra, statistics, probability, and optimization kernels             |
| [`@scenesystems/effect-study`](./packages/effect-study/README.md)         | Fixed-input evaluation, trial history, event recordings, and artifact persistence       |
| [`@scenesystems/effect-search`](./packages/effect-search/README.md)       | Black-box optimization with typed search spaces, samplers, and resumable studies        |
| [`@scenesystems/effect-dsp`](./packages/effect-dsp/README.md)             | Typed language model programs, evaluation, tracing, and prompt optimization             |
| [`@scenesystems/effect-lm`](./packages/effect-lm/README.md)               | Scoped model binding, generation settings, and model identity                           |
| [`@scenesystems/effect-inference`](./packages/effect-inference/README.md) | Model route resolution, provider configuration, and response evidence                   |
| [`@scenesystems/effect-text`](./packages/effect-text/README.md)           | Text measurement, hyphenation, and reusable greedy multiline layout                     |
| [`@scenesystems/digest`](./packages/digest/README.md)                     | Canonical JSON content identities, hashes, MACs, and key derivation                     |
| [`@scenesystems/seal`](./packages/seal/README.md)                         | Authenticated encryption and transport codecs                                           |
| [`@scenesystems/sign`](./packages/sign/README.md)                         | Digital signatures, key agreement, hybrid key encapsulation, and RS256 JWT verification |

Use `effect-study` when you already know the inputs to evaluate, or
`effect-search` to find a configuration by trying candidates. DSP uses Search
to optimize language-model programs and accepts any Effect `LanguageModel`
layer, including those supplied by Inference. The cryptography packages can
identify, sign, and encrypt results; their READMEs explain the key management
and protocol decisions your application must make.

## Run an optimization

This bounded example searches for the minimum of a two-variable function in Bun:

```sh
bun add @scenesystems/effect-search effect @effect/platform-bun
```

```ts typecheck
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Number } from "effect"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })
  const result = yield* Optimization.minimize(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 42 })),
      objective: ({ x, y }) => {
        const dx = Number.subtract(x, 2)
        const dy = Number.sum(y, 1)
        return Effect.succeed(Number.sum(Number.multiply(dx, dx), Number.multiply(dy, dy)))
      },
      trials: 50
    })
  )
  yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) =>
      Effect.log("Best trial", { value: bestTrial.state.value, config: bestTrial.config })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
```

Save this as `optimize.ts` and run `bun optimize.ts`. The function has a minimum
of zero at `x = 2`, `y = -1`; the search returns an approximation. With a seeded
sampler, repeatability also depends on the observations and their order. See
Search's [sampler guidance](./packages/effect-search/README.md#samplers-and-schedulers)
before relying on a seed to reproduce a run.

## Documentation and examples

Package READMEs supply the [docs-site guides](https://theoria.scenesystems.io/docs); public TSDoc supplies the API reference. Each package's `examples/` directory contains runnable programs.

Packages are pre-1.0 and versioned independently. Minor releases may change APIs. Pin a compatible version and read the package's `CHANGELOG.md` when upgrading.

## Contributing and support

See [Contributing](./CONTRIBUTING.md) for setup, checks, and pull requests, and the [app README](./apps/theoria/README.md) for running the documentation site. Maintainers use the [release runbook](./RELEASING.md).

Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for questions, defects, and proposals. Report vulnerabilities privately through the [security policy](./SECURITY.md). Participation follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
