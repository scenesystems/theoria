# `effect-search`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect-native black-box optimization for TypeScript.

Use it when you can evaluate a configuration, score the result, and want the
next trial to be chosen intelligently instead of manually.

## Why Use It

- Typed search spaces for floats, ints, categoricals, booleans, and conditionals.
- TPE, MOTPE, grid, random, GP-BO, CMA-ES, HyperBand, and BOHB under one surface.
- Objectives are plain `Effect`s, so optimization composes with the rest of your runtime.
- Deterministic seeds, streaming events, snapshots, and ask/tell control for real workflows.
- Built to support expensive evaluations such as prompt tuning, infrastructure tuning, and experiment search.

## Installation

```sh
npm install effect-search effect @effect/platform @effect/experimental
```

Use the equivalent `pnpm add` or `bun add` command if that is your package
manager. `@effect/sql` is an optional peer dependency for SQL-backed storage
integrations.

## Quick Start

```ts typecheck
import { Effect, Match } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (config) => Effect.succeed((config.x - 2) ** 2 + (config.y + 1) ** 2),
    trials: 50
  })

  return yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) =>
      Effect.succeed({
        bestValue: bestTrial.state.value,
        bestConfig: bestTrial.config
      })
    ),
    Match.tag("MultiObjective", () => Effect.succeed(undefined)),
    Match.exhaustive
  )
})

Effect.runPromise(program)
```

That is the core mental model: define a space, choose a sampler, run a study,
and inspect the best completed trial.

## Choosing A Sampler

| Sampler                                       | Use it when                                                 |
| --------------------------------------------- | ----------------------------------------------------------- |
| `Sampler.tpe()`                               | You have a mixed search space and evaluations are expensive |
| `Sampler.random()`                            | You want a baseline or the search space is small and cheap  |
| `Sampler.grid()`                              | You need exhaustive coverage of a finite space              |
| `Sampler.cmaEs()` or `Sampler.gpBo()`         | You are optimizing a continuous single-objective problem    |
| `Scheduler.hyperband()` or `Scheduler.bohb()` | Trials have a fidelity axis and you want early stopping     |

If you are unsure, start with `Sampler.tpe()`.

## Common Tasks

| Task                          | Start here                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| First end-to-end study        | [`examples/01-quick-start.ts`](./examples/01-quick-start.ts)               |
| Prompt tuning                 | [`examples/02-prompt-tuning.ts`](./examples/02-prompt-tuning.ts)           |
| Multi-objective optimization  | [`examples/04-multi-objective.ts`](./examples/04-multi-objective.ts)       |
| Conditional search spaces     | [`examples/07-conditional-spaces.ts`](./examples/07-conditional-spaces.ts) |
| Snapshot and resume           | [`examples/10-snapshot-resume.ts`](./examples/10-snapshot-resume.ts)       |
| Manual ask/tell orchestration | [`examples/25-ask-tell.ts`](./examples/25-ask-tell.ts)                     |

The main public lanes are `SearchSpace`, `Sampler`, `Study`, `Scheduler`,
`Pareto`, and `StudyEvent`.

## Learn More

- Browse the runnable examples in [`examples/`](./examples).
- Use `bun run docs:packages -- --catalog` from the repository root for the generated docs corpus.
- See [`effect-dsp`](../effect-dsp/README.md) for a package that uses `effect-search` to optimize language-model programs.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
