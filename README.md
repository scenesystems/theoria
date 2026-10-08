# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Theoria is an open-source TypeScript library collection for [Effect](https://effect.website): scientific computation, evaluation, black-box optimization, language model programming, text layout, and cryptography. Install the libraries you need; each is published independently under `@scenesystems` and requires Effect `^4.0.0`.

Start with the [documentation](https://theoria.scenesystems.io/docs) or a package README below. The libraries are developed by [Scene Systems](https://scenesystems.io/).

## Choose a package

| Package                                                                   | Use it for                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`@scenesystems/effect-math`](./packages/effect-math/README.md)           | Numerics, linear algebra, statistics, probability, and optimization kernels             |
| [`@scenesystems/effect-study`](./packages/effect-study/README.md)         | Fixed-input evaluation, trial history, event recordings, and artifact persistence       |
| [`@scenesystems/effect-search`](./packages/effect-search/README.md)       | Black-box optimization with typed search spaces, samplers, and resumable studies        |
| [`@scenesystems/effect-dsp`](./packages/effect-dsp/README.md)             | Typed language model programs, evaluation, tracing, and prompt optimization             |
| [`@scenesystems/effect-inference`](./packages/effect-inference/README.md) | Model route resolution, provider configuration, and response evidence                   |
| [`@scenesystems/effect-text`](./packages/effect-text/README.md)           | Text measurement, hyphenation, and reusable greedy multiline layout                     |
| [`@scenesystems/digest`](./packages/digest/README.md)                     | Canonical JSON content identities, hashes, MACs, and key derivation                     |
| [`@scenesystems/seal`](./packages/seal/README.md)                         | Authenticated encryption and transport codecs                                           |
| [`@scenesystems/sign`](./packages/sign/README.md)                         | Digital signatures, key agreement, hybrid key encapsulation, and RS256 JWT verification |

Use `effect-study` when you already know the inputs to evaluate; use `effect-search` when you need to discover a configuration. Search builds on Study and Math; DSP uses Search for prompt optimization and accepts an Effect `LanguageModel` layer, including one supplied by Inference. Text prepares measurements once and reuses them across layout widths.

For retained results, Digest identifies content, Sign binds bytes to an authenticated key, and Seal encrypts bytes. Applications own identity, authorization, key lifecycle, and protocol policy; the cryptography READMEs explain those boundaries.

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

Save this as `optimize.ts` and run `bun optimize.ts`. The minimum is zero at `x = 2`, `y = -1`; a finite search returns an approximation. The seed makes sampling repeatable for the same ordered observations and compatible implementation. External services, nondeterministic objectives, and concurrent completion order can change a real study's results.

## Documentation and examples

Package READMEs supply the [docs-site guides](https://theoria.scenesystems.io/docs); public TSDoc supplies the API reference. Runnable programs live in each package's `examples/` directory. Research references, standards, and provenance belong to the package that implements them.

Packages are pre-1.0 and versioned independently. Minor releases may change APIs. Pin a compatible version and read the package's `CHANGELOG.md` when upgrading.

## Contributing and support

See [Contributing](./CONTRIBUTING.md) for setup, checks, and pull requests, and the [app README](./apps/theoria/README.md) for running the documentation site. Maintainers use the [release runbook](./RELEASING.md).

Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for questions, defects, and proposals. Report vulnerabilities privately through the [security policy](./SECURITY.md). Participation follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
