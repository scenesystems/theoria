# `effect-search`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Bayesian optimization for TypeScript, built on [Effect](https://effect.website). Find better configurations in fewer tries — whether you're tuning LLM prompts, infrastructure settings, or ML hyperparameters.

[Quick start](#quick-start) · [Choosing a sampler](#choosing-a-sampler) · [How TPE works](#how-tpe-works) · [Recipes](#recipes) · [Pareto utilities](#pareto-utilities) · [Manual ask/tell](#manual-asktell-orchestration) · [Going deeper](#going-deeper) · [API at a glance](#api-at-a-glance) · [FAQ](#faq) · [Examples](#examples)

---

## Why effect-search?

Sometimes you can't write a formula for what you're optimizing. You can run a thing, measure how well it did, and try again with different settings — but there's no gradient to follow. That's black-box optimization, and it comes up everywhere:

- **Prompt tuning** — which temperature, system prompt, and few-shot count give the best answers?
- **Infrastructure config** — what worker count, batch size, and retry delay minimize latency?
- **Experiment design** — which flag combinations drive the most engagement?
- **ML hyperparameters** — what learning rate and architecture minimize validation loss?

`effect-search` replaces manual trial-and-error with algorithms that learn from previous results. When each evaluation costs seconds or minutes, that matters.

### What you get

- **Typed search spaces** — `float`, `int`, `categorical`, `boolean`, and tree-structured conditionals with full type inference
- **Three samplers** — Random (baseline), Grid (exhaustive), TPE (Bayesian optimization that gets smarter over time), plus HyperBand/BOHB multi-fidelity scheduling
- **Multi-objective** — MOTPE finds Pareto-optimal trade-offs when you have competing goals
- **Warm-starting** — inject trials from prior studies to skip the cold-start phase
- **Multivariate TPE** — joint density estimation for correlated parameter spaces
- **Noise-aware optimization** — adaptive bandwidth and re-evaluation averaging for noisy objectives (LLMs)
- **Constrained optimization** — c-TPE density ratios for inequality constraints
- **Budget and stopping controls** — `maxCost`, `targetValue`, `maxDuration`, `noImprovementWindow`
- **Trial timeout and retry** — per-trial timeouts with configurable retry schedules
- **Streaming events** — watch progress in real time with typed `Stream` events
- **Manual ask/tell orchestration** — run external evaluation loops with `Study.open`, `Study.ask`, and `Study.tell`
- **Snapshot and resume** — save study state, persist it anywhere, pick up where you left off
- **Objective caching** — deduplicate evaluations via shared `Cache.SchemaCache` authority and `StudyObjectiveCache` adapters
- **Persistent storage** — append-only trial log + atomic snapshots via `StudyStorage`
- **Interruption safety** — auto-checkpoint on interruption via `Scope` finalizers
- **Pruning** — kill unpromising trials early to save time
- **Deterministic** — same seed, same results, every time
- **Parallel evaluation** — run multiple trials concurrently with constant liar imputation
- **Space composition** — `extend`, `pick`, and `omit` to build search spaces from reusable fragments
- **No native deps** — pure TypeScript math. Just `effect`, `@effect/platform`, and `@effect/experimental` as peer dependencies

### When to use it (and when not to)

**Good fit:** expensive evaluations, mixed parameter types, reproducibility matters, multiple objectives.

**Look elsewhere:** differentiable training (use gradient descent), closed-form problems (use analytic solutions), tiny spaces (just enumerate them).

## Installation

```sh
npm install effect-search effect @effect/platform @effect/experimental
# or
pnpm add effect-search effect @effect/platform @effect/experimental
# or
bun add effect-search effect @effect/platform @effect/experimental
```

`effect`, `@effect/platform`, and `@effect/experimental` are peer dependencies — install them alongside `effect-search`.

## Quick start

Tell it what to search, how to score, and how many tries you want:

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  // 1. Define what you're searching over
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  // 2. Run the optimization
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: (config) => Effect.succeed((config.x - 2) ** 2 + (config.y + 1) ** 2),
    trials: 50
  })

  yield* Effect.log("Best value:", result.bestTrial.state.value)
  // Best value: ≈ 0.0 (finds x ≈ 2, y ≈ -1)
})

Effect.runPromise(program)
```

`Study.minimize` and `Study.maximize` are the fastest way to get started — they bake in the direction so you don't have to specify it. For multi-objective or more advanced options, use `Study.optimize` with an explicit `direction` or `directions`.

Your objective is just an `Effect` — it can call an LLM, hit a database, run a benchmark, or anything else. The search space gives you fully typed configs for free.

Examples in this README use effectful `SearchSpace.make` / `SearchSpace.makeConditional` constructors. Place snippets with `yield*` inside an `Effect.gen(function* () { ... })` context.

## Choosing a sampler

| Strategy                                     | Use when                                     | Strengths                                                           | Trade-offs                                            |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `Sampler.random()`                           | Baselines, cheap evaluations, exploration    | Simple, unbiased, parallelizes well                                 | No learning — doesn't improve with experience         |
| `Sampler.grid()`                             | Small finite spaces, exhaustive coverage     | Guaranteed to try every combination                                 | Doesn't scale — exponential in dimensions             |
| `Sampler.tpe()`                              | Expensive evaluations, mixed parameter types | Learns from history, handles categorical + continuous + conditional | Needs ~10 startup trials before it outperforms random |
| MOTPE (TPE with `directions`)                | Multiple competing objectives                | Finds Pareto-optimal trade-offs                                     | Requires more trials for meaningful fronts            |
| `Scheduler.hyperband()` / `Scheduler.bohb()` | Multi-fidelity with early stopping           | Allocates more budget to promising configs via successive halving   | Requires a `fidelity` dimension in the search space   |

**Start with `Sampler.tpe()`.** It works well across problem types and gets better as trials accumulate. Use `Sampler.random()` as a baseline to confirm TPE is actually helping. When evaluations have a natural fidelity axis (epochs, iterations, data fraction), consider HyperBand or BOHB — they stop bad configurations early and focus budget on winners.

## Core concepts

### Search space

Describe the parameters you want to optimize:

```ts
const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    batchSize: SearchSpace.int(16, 128, { step: 16 }),
    optimizer: SearchSpace.categorical(["adam", "sgd", "adamw"]),
    useBatchNorm: SearchSpace.boolean()
  })

  // Fully typed — hover over this in your editor
  type Config = SearchSpace.Type<typeof space>
  const configExample: Config = {
    learningRate: 0.01,
    batchSize: 32,
    optimizer: "adam",
    useBatchNorm: true
  }

  return { space, configExample }
})
```

| Dimension                          | What it searches               | Options                            |
| ---------------------------------- | ------------------------------ | ---------------------------------- |
| `SearchSpace.float(low, high)`     | Continuous `[low, high]`       | `scale: "linear" \| "log"`, `step` |
| `SearchSpace.int(low, high)`       | Integer `[low, high]`          | `step`                             |
| `SearchSpace.categorical(choices)` | One of a fixed set             | —                                  |
| `SearchSpace.boolean()`            | `true` or `false`              | —                                  |
| `SearchSpace.fidelity(low, high)`  | Resource budget for schedulers | `scale: "linear" \| "log"`         |

When different choices need different sub-parameters (e.g., a linear model needs a learning rate, a tree model needs max depth), use [conditional spaces](#conditional-search-spaces).

### Study

The study runs the optimization loop. For single-objective, use the directional shortcuts:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: evaluate,
    trials: 100,
    concurrency: 4 // run 4 evaluations in parallel
  })

  return result
})
```

Or use `Study.optimize` when you need explicit direction control or multi-objective:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: evaluate,
    direction: "minimize", // or "maximize", or use `directions` for multi-objective
    trials: 100
  })

  return result
})
```

Use `Study.optimizeStream` (or `Study.resumeStream`) instead if you want a `Stream` of lifecycle events for real-time progress monitoring.

### Trials, objectives, and concurrency

Each evaluation is a **trial** with a typed state — `Running`, `Completed`, `Failed`, `Pruned`, or `Cancelled`. Your **objective** receives a typed config and returns an `Effect` producing a score (or an array of scores for multi-objective). It can do anything Effect supports: LLM calls, HTTP requests, database queries.

When running trials in parallel, the sampler uses _constant liar_ imputation — it assumes pending trials will return the worst-seen value, so it explores different regions instead of clustering around the same one.

### Determinism

All samplers accept a `seed`. Same seed + same trial history = identical results, every time. No hidden mutable state.

## How TPE works

TPE (Tree-Structured Parzen Estimator) learns from your results to suggest better configurations over time:

1. **Start random.** Run a handful of trials to get a baseline.
2. **Split good from bad.** Rank completed trials and separate the top performers from the rest.
3. **Model the good region.** Fit a density estimate over the parameters of the good trials — this captures which parts of the space tend to produce better results.
4. **Suggest from the good region.** Sample new configurations that look more like the good group than the bad group.
5. **Repeat.** Each new result sharpens the model.

It handles mixed parameter types naturally — floats, ints, categoricals, and conditionals each get their own density model, scored jointly.

**When does TPE beat random?** When evaluations are expensive enough that wasting trials matters. If each run takes seconds or minutes, TPE will find better configurations faster. For very cheap evaluations, random search may be fine.

**MOTPE** extends this to multiple objectives. Instead of splitting on one score, it uses Pareto dominance — trials on the non-dominated frontier form the "good" group, weighted by hypervolume contribution. You get diverse trade-off solutions without collapsing objectives into one number.

**Advanced TPE modes:**

- **Multivariate mode** (`multivariate: true`) — joint diagonal Gaussian kernels capture parameter correlations instead of fitting each dimension independently
- **Noise-aware mode** (`noiseAware: true`) — widens KDE bandwidth proportional to estimated objective noise, preventing overfitting with stochastic evaluations
- **Constrained mode** (`constraints` in `Sampler.tpe(...)`) — c-TPE builds separate density models per constraint, biasing suggestions toward feasible regions (`constraintsCount` is derived internally)
- **Acquisition mode** (`acquisition: "ei" | "pi" | "thompson"`) — choose candidate ranking behavior: EI (expected improvement, default), PI (probability of improvement), or Thompson-style stochastic ranking

### Acquisition Strategies (EI, PI, Thompson)

TPE defaults to Expected Improvement (`"ei"`). You can switch to Probability of Improvement (`"pi"`) or Thompson-style stochastic ranking (`"thompson"`) directly in sampler options:

```ts
const result =
  yield *
  Study.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 42,
      nStartupTrials: 8,
      acquisition: "thompson"
    }),
    trials: 40,
    objective: evaluate
  })
```

Use EI as the default baseline. Try PI when you want greedier exploitation near likely improvements, and Thompson when you want more stochastic exploration while remaining deterministic under fixed seeds.

## Recipes

### Prompt optimization

Find the temperature, system prompt style, and few-shot count that produce the best LLM answers. In practice, your objective would call an LLM and evaluate the response — here we simulate it:

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0.0, 1.5),
    systemPrompt: SearchSpace.categorical(["concise", "detailed", "step-by-step"]),
    fewShotCount: SearchSpace.int(0, 5)
  })

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 30,
    objective: (config) => {
      const tempScore = 1 - Math.abs(config.temperature - 0.7)
      const styleScore = config.systemPrompt === "step-by-step" ? 0.9 : config.systemPrompt === "detailed" ? 0.7 : 0.5
      const demoScore = Math.min(config.fewShotCount * 0.15, 0.6)
      return Effect.succeed(tempScore + styleScore + demoScore)
    }
  })

  yield* Effect.log("Best quality:", result.bestTrial.state.value)
})

Effect.runPromise(program)
```

### Hyperparameter tuning

Search over model hyperparameters to minimize validation loss:

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    depth: SearchSpace.int(1, 8),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 21, nStartupTrials: 6 }),
    trials: 40,
    objective: (config) => {
      const lrPenalty = (config.learningRate - 0.02) ** 2
      const depthCost = config.depth * 0.05
      const optimizerBonus = config.optimizer === "adam" ? 0 : 0.2
      return Effect.succeed(lrPenalty + depthCost + optimizerBonus)
    }
  })

  yield* Effect.log("Best loss:", result.bestTrial.state.value)
})

Effect.runPromise(program)
```

### Infrastructure tuning

Find the worker count, batch size, and strategy that maximize throughput:

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    workerCount: SearchSpace.int(1, 16),
    batchSize: SearchSpace.int(100, 10000, { step: 100 }),
    retryDelay: SearchSpace.float(0.1, 10.0),
    strategy: SearchSpace.categorical(["round-robin", "least-conn", "random"])
  })

  const result = yield* Study.maximize({
    space,
    sampler: Sampler.tpe({ seed: 7 }),
    trials: 30,
    objective: (config) => {
      const workerGain = Math.log2(config.workerCount + 1) * 1000
      const batchGain = Math.sqrt(config.batchSize) * 10
      const retryPenalty = config.retryDelay * 50
      const strategyBonus = config.strategy === "least-conn" ? 200 : config.strategy === "round-robin" ? 100 : 0
      return Effect.succeed(workerGain + batchGain + strategyBonus - retryPenalty)
    }
  })

  yield* Effect.log("Best throughput:", result.bestTrial.state.value)
})

Effect.runPromise(program)
```

### Multi-objective: quality vs latency

When you care about trade-offs — not just one number — use `directions` to optimize multiple goals at once. MOTPE finds the Pareto frontier: the set of configurations where you can't improve one objective without hurting another.

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study, Contracts } from "effect-search"

// Each setting has a latency cost and a quality cost
const costs: Record<string, { latency: number; quality: number }> = {
  baseline: { latency: 0.3, quality: 2.0 },
  detailed: { latency: 1.2, quality: 0.8 },
  socratic: { latency: 2.1, quality: 0.5 },
  none: { latency: 0.1, quality: 1.8 },
  few: { latency: 0.6, quality: 0.9 },
  curated: { latency: 1.3, quality: 0.2 },
  strict: { latency: 1.1, quality: 0.4 },
  balanced: { latency: 0.5, quality: 0.9 },
  recall: { latency: 0.2, quality: 1.4 }
}

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    instruction: SearchSpace.categorical(["baseline", "detailed", "socratic"]),
    demos: SearchSpace.categorical(["none", "few", "curated"]),
    scoring: SearchSpace.categorical(["strict", "balanced", "recall"])
  })

  const result = yield* Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 919 }),
    directions: ["minimize", "minimize"],
    trials: 30,
    objective: (config) => {
      const parts = [costs[config.instruction], costs[config.demos], costs[config.scoring]]
      const latency = parts.reduce((sum, p) => sum + p.latency, 0)
      const quality = parts.reduce((sum, p) => sum + p.quality, 0)
      return Effect.succeed([latency, quality])
    }
  })

  if (result._tag === "MultiObjective") {
    const front = result.paretoFront.map((t) => Contracts.normalizeObjectiveVector(t.state.value))
    yield* Effect.log("Pareto front size:", front.length)
  }
})

Effect.runPromise(program)
```

## Pareto utilities

You can access Pareto and hypervolume math directly via `Pareto` from the root package, or as a subpath import from `effect-search/Pareto`.

```ts
import { Pareto } from "effect-search"

const points = [
  [1, 4],
  [2, 2],
  [3, 1],
  [4, 3]
]

const front = Pareto.nonDominatedIndices(points, ["minimize", "minimize"])
const ranks = Pareto.nonDominatedRanks(points, ["minimize", "minimize"])
const reference = [4.4, 4.4]
const hypervolume = Pareto.hypervolume2d(points, reference)
const contributions = Pareto.hypervolumeContribution2d(points, reference)
```

Stable Pareto exports: `dominates`, `nonDominatedIndices`, `nonDominatedSort`, `nonDominatedRanks`, `hypervolume2d`, and `hypervolumeContribution2d`.

## Manual ask/tell orchestration

Use ask/tell mode when evaluation happens outside `Study.optimize`, such as external workers, human review loops, or custom orchestration runtimes.

```ts
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.scoped(
  Effect.gen(function* () {
    const space = yield* SearchSpace.make({
      temperature: SearchSpace.float(0, 1),
      topP: SearchSpace.float(0.1, 1)
    })

    const handle = yield* Study.open({
      space,
      sampler: Sampler.random({ seed: 123 }),
      direction: "minimize",
      trials: 3,
      objective: () => Effect.succeed(0) // objective is evaluated externally in ask/tell mode
    })

    const reserved = yield* Study.ask(handle)
    const score = reserved.config.temperature + reserved.config.topP
    yield* Study.tell(handle, reserved.trialNumber, score)

    const checkpoint = yield* Study.snapshot(handle)
    const finalResult = yield* Study.result(handle)

    return { checkpoint, finalResult }
  })
)

Effect.runPromise(program)
```

The full manual surface is `Study.open`, `Study.ask`, `Study.tell`, `Study.fail`, `Study.cancel`, `Study.result`, `Study.snapshot`, and `Study.events`.

## Going deeper

### Conditional search spaces

Some parameters only make sense when another parameter has a certain value — a linear model needs a learning rate, but a tree model needs max depth instead:

```ts
const program = Effect.gen(function* () {
  const linearBranch = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" })
  })

  const treeBranch = yield* SearchSpace.make({
    maxDepth: SearchSpace.int(2, 12)
  })

  const space = yield* SearchSpace.makeConditional(
    { model: SearchSpace.categorical(["linear", "tree"]) },
    SearchSpace.switch("model", [SearchSpace.when("linear", linearBranch), SearchSpace.when("tree", treeBranch)])
  )

  return space
})
```

TPE handles this automatically — it fits separate density models for each branch, using only the trials that actually activated that branch.

### Composing search spaces

Build spaces from reusable fragments with `extend`, `pick`, and `omit`:

```ts
const program = Effect.gen(function* () {
  const base = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    batchSize: SearchSpace.int(16, 128, { step: 16 })
  })

  const regularization = yield* SearchSpace.make({
    dropout: SearchSpace.float(0.0, 0.5),
    weightDecay: SearchSpace.float(1e-5, 1e-2, { scale: "log" })
  })

  // Merge two spaces — fails with InvalidSearchSpace if names conflict
  const full = yield* SearchSpace.extend(base, regularization)

  // Select a subset of dimensions
  const small = yield* SearchSpace.pick(full, ["learningRate", "dropout"])

  // Remove dimensions you don't need
  const noRegularization = yield* SearchSpace.omit(full, ["dropout", "weightDecay"])

  return { full, small, noRegularization }
})
```

All three return `Effect` values — they validate the result and fail with `InvalidSearchSpace` if the projection is invalid (e.g., picking a name that doesn't exist, or omitting a dimension that a conditional branch depends on).

### HyperBand and BOHB

When your evaluation has a natural fidelity axis — training epochs, data fraction, iteration count — multi-fidelity schedulers save budget by stopping bad configurations early. Instead of running every trial to full fidelity, they start many configs at low fidelity and promote only the best to higher budgets.

```ts
import { Effect } from "effect"
import { Scheduler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    momentum: SearchSpace.float(0.5, 0.99)
  })

  // BOHB combines HyperBand's successive halving with TPE's Bayesian suggestions
  const scheduler = yield* Scheduler.bohb({
    maxResource: 81, // maximum fidelity budget per trial
    reductionFactor: 3, // promote top 1/3 each round
    seed: 42
  })

  const result = yield* Study.minimize({
    space,
    scheduler,
    objective: (config, runtime) =>
      Effect.gen(function* () {
        // runtime.resource tells you the budget for this trial
        const epochs = runtime.resource ?? 81
        const loss = (config.learningRate - 0.01) ** 2 + (1 - config.momentum) * (1 / epochs)
        return loss
      })
  })

  yield* Effect.log("Best loss:", result.bestTrial.state.value)
})

Effect.runPromise(program)
```

`Scheduler.hyperband()` uses random suggestions. `Scheduler.bohb()` adds TPE-guided sampling — after accumulating enough observations, it suggests from the promising region instead of exploring randomly.

### Pruning

If your evaluation has intermediate steps (like training epochs), you can report progress and let the study kill unpromising trials early:

```ts
const result =
  yield *
  Study.optimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    direction: "minimize",
    trials: 30,
    pruningPolicy: Study.thresholdPruningPolicy(5.0, "minimize", 3),
    objective: (config, runtime) =>
      Effect.iterate(
        { step: 0, loss: 10.0 },
        {
          while: ({ step }) => step < 20,
          body: ({ step, loss }) =>
            Effect.gen(function* () {
              const next = loss * 0.9 + 0.05
              const decision = yield* runtime.report(step, next)
              return decision._tag === "Prune"
                ? { step: 20, loss: next } // stop early
                : { step: step + 1, loss: next }
            })
        }
      ).pipe(Effect.map(({ loss }) => loss))
  })
```

The `runtime` also gives you `runtime.heartbeat` (cooperative shutdown check) and `runtime.requestStop(reason)` (stop the entire study from within a trial).

### Warm-starting

Inject known-good configurations from a previous study to skip the cold-start phase:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 50,
    priorTrials: [
      new Study.PriorTrial({ config: { x: 2.1, y: -0.9 }, value: 0.02 }),
      new Study.PriorTrial({ config: { x: 1.8, y: -1.2 }, value: 0.08 })
    ],
    priorWeight: 0.5,
    objective: (config) => Effect.succeed((config.x - 2) ** 2 + (config.y + 1) ** 2)
  })

  return result
})
```

### Cost tracking and budget limits

Stop the study when cumulative cost exceeds a budget. Report cost by returning a `Study.ObjectiveReport` from your objective instead of a raw number:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 200,
    maxCost: 50.0,
    objective: (config) => {
      const score = (config.x - 2) ** 2
      return Effect.succeed(new Study.ObjectiveReport({ value: score, cost: 1.0 }))
    }
  })

  return result
})
```

The study emits `TrialCosted` events and completes with `"budgetExhausted"` when the limit is reached.

### Constrained optimization

Use c-TPE to bias suggestions toward feasible regions. Pass constraint evaluators to the TPE sampler:

```ts
const program = Effect.gen(function* () {
  const decodeConfig = Schema.decodeUnknownSync(space.schema)
  const constraint = (rawConfig: unknown) =>
    Effect.sync(() => {
      const config = decodeConfig(rawConfig)
      return config.x + config.y - 3
    })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 42,
      constraints: [constraint]
    }),
    trials: 50,
    objective: (config) => Effect.succeed((config.x - 2) ** 2 + (config.y + 1) ** 2)
  })

  return result
})
```

Constraint functions return ≤ 0 for feasible configurations. Constraint evaluators receive `unknown` configs, so decode against `space.schema` when you need typed access. `constraintsCount` is inferred from the constraints array.

### Trial timeout and retry

Set per-trial timeouts with automatic retries on failure:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 30,
    trialTimeout: "10 seconds",
    retrySchedule: Schedule.exponential("100 millis").pipe(Schedule.intersect(Schedule.recurs(3))),
    objective: evaluate
  })

  return result
})
```

Failed trials emit `TrialRetried` events on each attempt and `TrialCancelled` on timeout.

### Objective caching

Deduplicate evaluations across resumed studies:

```ts
const program = Study.minimize({
  space,
  sampler: Sampler.tpe({ seed: 42 }),
  trials: 100,
  objective: evaluate
}).pipe(Effect.provide(Study.StudyObjectiveCacheMemory()))
```

Use `Study.StudyObjectiveCacheFileSystem("./study-cache")` for disk-backed caching that persists across process restarts. Cache scope/version routing is managed by `Study.studyObjectiveCacheOptions(scope)` and `Cache.makeDescriptor(...)`.

### Persistent storage

File-backed crash-safe persistence with append-only trial log and atomic snapshots:

```ts
const storageLayer = Study.StudyStorageLive(Study.studyStorageOptions("./study-data"))

const program = Effect.gen(function* () {
  const initial = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 100,
    objective: evaluate
  }).pipe(Effect.provide(storageLayer))

  // Resume from storage in a later session
  const resumed = yield* Study.resumeFromStorage({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: evaluate,
    direction: "minimize",
    trials: 50
  }).pipe(Effect.provide(storageLayer))

  return { initial, resumed }
})
```

Use `Study.resumeFromStorageStream` for the streaming variant.

### Stopping policies

Control when the study stops with convergence and budget checks:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 500,
    targetValue: 0.01,
    noImprovementWindow: 20,
    maxDuration: "5 minutes",
    epsilon: 1e-6,
    objective: evaluate
  })

  return result
})
```

The study completes with a typed `CompletionReason` — `"targetReached"`, `"noImprovement"`, `"durationExceeded"`, `"convergence"`, or `"budgetExhausted"`.

### Multivariate and noise-aware TPE

Enable joint density estimation and noise-robust bandwidth:

```ts
const program = Effect.gen(function* () {
  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42, multivariate: true, noiseAware: true }),
    trials: 50,
    objective: evaluate
  })

  return result
})
```

### Streaming events

Watch optimization happen in real time with the first-party terminal reporter:

```ts
import { Chunk, Effect, Stream } from "effect"
import { Study } from "effect-search"

const program = Effect.gen(function* () {
  const events = yield* Study.optimizeStream({
    space,
    sampler,
    objective,
    direction: "minimize",
    trials: 100
  }).pipe(Study.tapTerminalProgress(), Stream.runCollect)

  const completed = Chunk.toReadonlyArray(events).filter((event) => event._tag === "TrialCompleted").length
  yield* Effect.log("Completed trials", completed)
})
```

The same compositional boundary works when resuming:

```ts
Study.resumeStream({
  space,
  sampler,
  snapshot,
  direction: "minimize",
  trials: 20,
  objective
}).pipe(Study.tapTerminalProgress(), Stream.runDrain)
```

Need custom output behavior (for CI logs, structured logs, or forced plain mode)?
Inject a sink while keeping the same formatter semantics:

```ts
const sink = Study.makeTerminalSink({
  supportsAnsi: Effect.succeed(false),
  writeStdout: (line) => Effect.log(`[study] ${line}`),
  writeStderr: (line) => Effect.logWarning(`[study] ${line}`)
})

Study.optimizeStream({
  space,
  sampler,
  objective,
  direction: "minimize",
  trials: 100
}).pipe(Study.tapTerminalProgress({ sink }), Stream.runDrain)
```

For one-shot event emission (for example, in manual orchestration adapters), use `Study.reportTerminalProgress`:

```ts
import { Study, StudyEvent } from "effect-search"

yield * Study.reportTerminalProgress(StudyEvent.StudyCompleted({ completionReason: "budgetExhausted" }), { sink })
```

### DevTools tracing

To inspect optimization spans and fibers in real time, provide `DevTools.layer()` from `@effect/experimental`.

```ts
import * as DevTools from "@effect/experimental/DevTools"
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({ x: SearchSpace.float(-5, 5) })

  return yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    trials: 20,
    objective: (config) => Effect.succeed((config.x - 1.5) ** 2)
  })
})

Effect.runPromise(program.pipe(Effect.provide(DevTools.layer())))
```

All public `Study` APIs are wrapped with named `Effect.fn` spans, so calls like `Study.optimize`, `Study.resume`, and `Study.snapshot` appear with explicit span names in DevTools.

### Rate-limited objectives

When your objective hits external APIs (LLMs, embedding endpoints, evaluators), wrap it with `RateLimiter` so study concurrency never exceeds provider quotas.

```ts
import * as RateLimiter from "@effect/experimental/RateLimiter"
import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    temperature: SearchSpace.float(0, 1.2),
    maxTokens: SearchSpace.int(128, 2048, { step: 128 })
  })

  const evaluatePrompt = (config: SearchSpace.Type<typeof space>) =>
    Effect.gen(function* () {
      // effect-dsp style seam: this is where your LLM call + metric pipeline runs.
      const quality = 1 - Math.abs(config.temperature - 0.65)
      const tokenPenalty = config.maxTokens / 4096
      return quality - tokenPenalty
    })

  const limiter = yield* RateLimiter.make({ limit: 10, interval: "1 second" })

  const limitedObjective = (config: SearchSpace.Type<typeof space>) => limiter(evaluatePrompt(config))

  return yield* Study.maximize({
    space,
    sampler: Sampler.tpe({ seed: 7 }),
    objective: limitedObjective,
    trials: 40
  })
})
```

### Snapshot and resume

Save study state to pick up where you left off later:

```ts
const program = Effect.gen(function* () {
  // Save after a run
  const snapshot = yield* Study.snapshot(result)
  const encoded = yield* Schema.encode(Study.StudySnapshot)(snapshot)
  // Persist `encoded` to disk, database, S3 — wherever you want

  // Resume in a later session
  const restored = yield* Schema.decode(Study.StudySnapshot)(encoded)
  const resumed = yield* Study.resume({
    space,
    sampler: Sampler.tpe(samplerOptions),
    snapshot: restored,
    objective,
    direction: "minimize",
    trials: 50 // run 50 more trials
  })

  return resumed
})
```

Resume validates that the space, objectives, and sampler are compatible with the snapshot. If anything doesn't match, you get an `InvalidStudyConfig` error.

Use `Study.resumeStream` instead of `Study.resume` if you want lifecycle events while resuming — it works the same as `Study.optimizeStream` but picks up from the snapshot.

For file-backed persistence, use `Study.resumeFromStorage` (or `Study.resumeFromStorageStream`) with a `StudyStorageLive` layer — it reads the snapshot from disk automatically without manual Schema decode. See [Persistent storage](#persistent-storage).

### Error handling

Every error is tagged, so you can match and handle them precisely:

| Error                    | What happened                                       |
| ------------------------ | --------------------------------------------------- |
| `InvalidSearchSpace`     | Bad dimension bounds or missing metadata            |
| `InvalidSamplerConfig`   | Malformed sampler options                           |
| `InvalidStudyConfig`     | Invalid study options or snapshot mismatch          |
| `GridIncompatible`       | Grid sampler with non-enumerable dimensions         |
| `SamplerExhausted`       | No more configurations to try                       |
| `InvalidObjectiveValue`  | Objective returned NaN or Infinity                  |
| `InvalidObjectiveReport` | Bad intermediate report (invalid step or value)     |
| `InvalidMathInput`       | Degenerate input to internal math                   |
| `TrialError`             | Individual trial failed during objective evaluation |
| `NotImplemented`         | Feature not yet available                           |
| `NoSuccessfulTrials`     | Every trial failed — no best result                 |

```ts
program.pipe(Effect.catchTag("NoSuccessfulTrials", (e) => Effect.log(`All ${e.trialCount} trials failed`)))
```

All errors carry a qualified `_tag` (e.g., `"effect-search/InvalidStudyConfig"`) and share the `SearchErrorTypeId` symbol. Use `Errors.SearchErrorSchema` as the union type, and `Errors.isSearchError` as a type guard for catch-all handling.

## API at a glance

```ts
import {
  Contracts,
  Errors,
  Experimental,
  Pareto,
  Sampler,
  Scheduler,
  SearchSpace,
  Study,
  StudyEvent,
  Trial
} from "effect-search"
```

| Module         | Key exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SearchSpace`  | `make`, `makeConditional`, `float`, `int`, `categorical`, `boolean`, `fidelity`, `switch`, `when`, `extend`, `pick`, `omit`, `Type`                                                                                                                                                                                                                                                                                                                                                      |
| `Sampler`      | `random`, `grid`, `tpe`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Scheduler`    | `hyperband`, `bohb`, `Scheduler`, `totalTrials`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Study`        | `minimize`, `maximize`, `optimize`, `optimizeStream`, `resumeStream`, `snapshot`, `resume`, `resumeFromStorage`, `resumeFromStorageStream`, `pareto`, `tapTerminalProgress`, `reportTerminalProgress`, `makeTerminalSink`, `formatTerminalProgressEvent`, `StudySnapshot`, `PriorTrial`, `ObjectiveReport`, `StudyObjectiveCache`, `StudyObjectiveCacheMemory`, `StudyObjectiveCacheFileSystem`, `StudyStorage`, `StudyStorageLive`, `thresholdPruningPolicy`, `shouldPruneByPercentile` |
| `Trial`        | `matchState`, trial state types (`Running`, `Completed`, `Failed`, `Pruned`, `Cancelled`)                                                                                                                                                                                                                                                                                                                                                                                                |
| `StudyEvent`   | `matchStudyEvent`, `isStudyEvent`, event types (`TrialStarted`, `TrialCompleted`, `TrialReported`, `TrialCosted`, `TrialPruned`, `TrialRetried`, `TrialCancelled`, `TrialFailed`, `BestUpdated`, `StudyStopRequested`, `BracketStarted`, `RoundStarted`, `RoundCompleted`, `BracketCompleted`, `StudyCompleted`)                                                                                                                                                                         |
| `Errors`       | Tagged errors: `InvalidSearchSpace`, `InvalidSamplerConfig`, `InvalidStudyConfig`, `NoSuccessfulTrials`, `TrialError`, `NotImplemented`, …; union: `SearchErrorSchema`, `isSearchError`                                                                                                                                                                                                                                                                                                  |
| `Contracts`    | Stable shared contracts: `Direction`, `Distribution`, `ObjectiveSpec`, `ObjectiveValue`                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Pareto`       | `dominates`, `nonDominatedIndices`, `nonDominatedSort`, `nonDominatedRanks`, `hypervolume2d`, `hypervolumeContribution2d`, `ObjectiveVectorSchema`                                                                                                                                                                                                                                                                                                                                       |
| `Experimental` | Unstable extension surface for advanced integrations                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Subpath imports are also available: `import * as SearchSpace from "effect-search/SearchSpace"` and `import * as Pareto from "effect-search/Pareto"`. Internal modules (`internal/*`) are blocked from consumers via the package exports map.

## FAQ

**Is this Bayesian optimization?**
Yes. The TPE sampler implements Tree-Structured Parzen Estimation, verified against [Optuna](https://github.com/optuna/optuna) via deterministic golden fixtures.

**Can my objective call an LLM / database / API?**
Yes. The objective is an `Effect`, so it can do anything — HTTP requests, LLM calls, database queries, file I/O.

**How does parallel evaluation work?**
Pass `concurrency: N` to run multiple trials simultaneously. The sampler uses constant liar imputation to avoid clustering evaluations in the same region.

**When should I use multi-objective?**
When you have competing goals (quality vs latency, accuracy vs cost) and don't want to collapse them into one score. MOTPE gives you the Pareto front.

**What if all my trials fail?**
You get a `NoSuccessfulTrials` error. All errors are tagged — match and handle them however you want.

**What's the difference between HyperBand and BOHB?**
Both use successive halving — start many configs at low fidelity, promote the best. HyperBand uses random suggestions; BOHB replaces random with TPE after accumulating enough observations. Use BOHB when evaluations are expensive enough that informed suggestions matter.

**How does this compare to Optuna?**
TPE output is verified against Optuna via deterministic golden fixtures — same inputs, same outputs. One intentional difference: `effect-search` enforces strict monotonic-step reporting in intermediate trial reports. Optuna silently accepts duplicate steps; we return a typed error to prevent data corruption in concurrent loops.

**Can I warm-start from a previous study?**
Yes. Pass `priorTrials` to inject prior observations. The sampler treats them as completed trials for density estimation without re-evaluating them.

**How do I handle noisy objectives?**
Use `noiseAware: true` on the TPE sampler and/or `evaluationsPerTrial: N` to average over multiple evaluations per config.

**Can I set a cost budget?**
Yes. `maxCost` stops the study when cumulative cost exceeds the limit. Report cost by returning `new Study.ObjectiveReport({ value, cost })` from your objective.

**What if my objective has constraints?**
Use c-TPE by passing `constraints` to `Sampler.tpe()`. Constraint functions return ≤ 0 for feasible configurations.

**How do I persist study state to disk?**
Use `StudyStorageLive` with `Study.resumeFromStorage`. It handles atomic snapshots and append-only trial logs for crash-safe recovery.

## Examples

Runnable examples in [`examples/`](./examples):

| Example                                                                    | What it shows                                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`01-quick-start`](./examples/01-quick-start.ts)                           | Minimize a 2D function with TPE                                |
| [`02-prompt-tuning`](./examples/02-prompt-tuning.ts)                       | Find the best prompt settings                                  |
| [`03-streaming-events`](./examples/03-streaming-events.ts)                 | Terminal progress reporting across optimize and resume streams |
| [`04-multi-objective`](./examples/04-multi-objective.ts)                   | MOTPE: quality vs latency Pareto front                         |
| [`05-grid-search`](./examples/05-grid-search.ts)                           | Exhaustive search over a small space                           |
| [`06-sampler-comparison`](./examples/06-sampler-comparison.ts)             | Random vs TPE head-to-head                                     |
| [`07-conditional-spaces`](./examples/07-conditional-spaces.ts)             | Tree-structured configs for model-family search                |
| [`08-cost-budget`](./examples/08-cost-budget.ts)                           | Budget-aware optimization with `ObjectiveReport`               |
| [`09-warm-start`](./examples/09-warm-start.ts)                             | Seeding TPE with historical `PriorTrial` data                  |
| [`10-snapshot-resume`](./examples/10-snapshot-resume.ts)                   | Serialized snapshot checkpoint and resume flow                 |
| [`11-storage-resume`](./examples/11-storage-resume.ts)                     | File-backed `StudyStorage` resume from disk                    |
| [`12-trial-cache`](./examples/12-trial-cache.ts)                           | Objective deduplication with `StudyObjectiveCache`             |
| [`13-resume-stream`](./examples/13-resume-stream.ts)                       | Streaming events while resuming from snapshot                  |
| [`14-hyperband-bohb`](./examples/14-hyperband-bohb.ts)                     | HyperBand vs BOHB multi-fidelity scheduling                    |
| [`15-constrained-optimization`](./examples/15-constrained-optimization.ts) | c-TPE feasibility constraints                                  |
| [`16-noise-aware`](./examples/16-noise-aware.ts)                           | Noise-aware TPE with multi-evaluation averaging                |
| [`17-trial-timeout-retry`](./examples/17-trial-timeout-retry.ts)           | Retry schedules with timeout cancellation                      |
| [`18-space-composition`](./examples/18-space-composition.ts)               | Compose reusable spaces with `extend/pick/omit`                |
| [`19-pruning`](./examples/19-pruning.ts)                                   | Intermediate reporting with threshold pruning                  |
| [`20-early-stopping`](./examples/20-early-stopping.ts)                     | Target/no-improvement/duration stopping controls               |
| [`21-parallel-evaluation`](./examples/21-parallel-evaluation.ts)           | Concurrent trials with bounded worker pools                    |
| [`22-multivariate-tpe`](./examples/22-multivariate-tpe.ts)                 | Correlated-dimension optimization with TPE                     |
| [`23-devtools`](./examples/23-devtools.ts)                                 | Effect DevTools tracing for Study spans                        |
| [`24-rate-limiter`](./examples/24-rate-limiter.ts)                         | Rate-limited objective execution                               |
| [`25-ask-tell`](./examples/25-ask-tell.ts)                                 | Manual `Study.open` + `ask/tell` orchestration                 |
| [`26-acquisition-strategies`](./examples/26-acquisition-strategies.ts)     | Compare `ei`, `pi`, and `thompson` in `Sampler.tpe`            |

Advanced application examples live in [`examples/applications/`](./examples/applications):

| Advanced Example                                                                                             | What it shows                                                          |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [`applications/01-lab-assay-motpe`](./examples/applications/01-lab-assay-motpe.ts)                           | Tune assay settings for accuracy, safety, and runtime trade-offs       |
| [`applications/02-social-dynamics-intervention`](./examples/applications/02-social-dynamics-intervention.ts) | Tune intervention policies to balance outcomes and facilitator load    |
| [`applications/03-product-rollout-policy`](./examples/applications/03-product-rollout-policy.ts)             | Tune rollout policy for growth while honoring churn and latency limits |
| [`applications/04-developer-ci-autotune`](./examples/applications/04-developer-ci-autotune.ts)               | Tune CI settings for faster feedback within a fixed spend budget       |

```sh
bun run examples/01-quick-start.ts
# or: npx tsx examples/01-quick-start.ts
```

## Status

All core features are implemented and tested: search spaces, three samplers (Random, Grid, TPE), single and multi-objective optimization, snapshot/resume, pruning, conditional spaces, streaming events, multivariate TPE, noise-aware bandwidth, HyperBand/BOHB multi-fidelity scheduling, warm-starting with prior trials, c-TPE constrained optimization, budget-aware stopping, file-backed persistence via `StudyStorage`, objective caching via `StudyObjectiveCache` on shared `Cache.SchemaCache`, and full Effect-native runtime architecture. Mathematical correctness is verified against [Optuna](https://github.com/optuna/optuna) via golden fixtures, property-based invariant tests, and trace replay suites.

`effect-search` is the optimization engine behind [`effect-dsp`](https://github.com/scenesystems/effect-dsp), an Effect-native declarative signal programming framework.

## Contributing

```sh
bun run check    # Type check
bun run test     # Run tests
bun run lint     # Lint
bun run build    # Build ESM + CJS
```

Mathematical correctness is tested against golden fixtures generated from Optuna:

```sh
bun run fixtures:check      # Validate committed fixtures against TS schemas
bun run fixtures:generate   # Regenerate from Python/Optuna
bun run fixtures:verify     # Re-derive expected values and assert parity
```

Fixture generation uses [uv](https://docs.astral.sh/uv/) — no manual `pip install` or virtualenv needed.

## Release Checklist (Script-First)

Run the release gates as executable contracts, not memory-based checklist steps:

```sh
bun run publish:check
bun run check
bun run lint
bun run test
bun run build
bun run fixtures:check
bun run changeset-publish --dry-run
```

`publish:check` is the single-source release contract for package metadata, export boundaries, keyword coverage, and script wiring. `changeset-publish` re-runs `publish:check --require-packed-manifest` after build so packed-manifest export boundaries are enforced before publish.

Monorepo topology enforcement (`scenesystems/theoria` + `repository.directory`) is tracked as an explicit TODO contract until `effect-search` is moved.

## Acknowledgments

The TPE implementation is based on the work of [Bergstra et al. (2011)](https://papers.nips.cc/paper/2011/hash/86e8f7ab32cfd12577bc2619bc635690-Abstract.html), with bandwidth selection and weighting strategies informed by [Watanabe (2023)](https://arxiv.org/abs/2304.11127). Multi-objective optimization follows the MOTPE algorithm from [Ozaki et al. (2022)](https://doi.org/10.1613/jair.1.13188), using hypervolume contribution weighting from [Guerreiro et al. (2021)](https://doi.org/10.1145/3453474). Constrained TPE follows c-TPE from [Watanabe & Hutter (2023)](https://doi.org/10.24963/ijcai.2023/486). HyperBand scheduling follows [Li et al. (2017)](https://jmlr.org/papers/v18/16-558.html), with BOHB combining it with TPE per [Falkner et al. (2018)](https://proceedings.mlr.press/v80/falkner18a.html). Parallel evaluation uses constant liar imputation from [Ginsbourger et al. (2010)](https://doi.org/10.1007/978-3-642-10701-6_6).

[Optuna](https://github.com/optuna/optuna) is the reference implementation we verify against — our golden fixture pipeline generates expected values from Optuna and asserts parity in TypeScript. The `Sampler` interface design draws from Optuna's ask-and-tell pattern, adapted for Effect's structured concurrency.

Built on [Effect](https://effect.website). `effect-search` is the optimization engine behind [`effect-dsp`](https://github.com/scenesystems/effect-dsp), which brings [DSPy](https://github.com/stanfordnlp/dspy)'s declarative signal programming paradigm to TypeScript.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
