# Theoria

[![CI](https://github.com/scenesystems/theoria/actions/workflows/check.yml/badge.svg)](https://github.com/scenesystems/theoria/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

**Open computational foundations for turning observation into knowledge, and
knowledge into things people can build together.**

Theoria is Scene Systems' family of TypeScript libraries for scientific
computing, model programming, text, and cryptography. The packages help an
application measure outcomes, explore alternatives, improve model-assisted
programs, reproduce how a result was made, and preserve the identity,
authorship, and privacy of artifacts as they evolve.

The name comes from the Greek _theoria_ (θεωρία): observation that produces
knowledge. That idea is the thread through the repository. Observation becomes
valuable when it can be made explicit, tested, compared, and carried forward.

[Explore the live examples](https://theoria.scenesystems.io/) or [see how the
packages fit together](#how-the-pieces-fit) in an Effect application.

## Why Theoria exists

[Scene Systems](https://scenesystems.io/) is working toward a future where
people and machines can turn imagination into shared reality. A person should
be able to begin a persistent World—a place, story, tool, community, theory, or
future—then invite others to enter it, contribute, branch, merge, and help make
it real. Over time, a World can hold its founding intent, participants,
history, alternatives, authorship, decisions, and open possibilities.

Making something once is only the beginning. A creation that continues across
people, models, and years raises harder questions:

- What was observed, and how certain are we?
- Which alternative worked better, and under which trade-offs?
- Which program, model, provider, and route produced this result?
- Can the work be reproduced after its runtime changes?
- What changed, who contributed it, and what must remain private?

Theoria turns these questions into explicit computations instead of leaving
them as invisible application glue. It is scientific in method rather than
limited to one scientific field: define the values and boundaries, perform the
work as a typed program, measure the evidence, compare alternatives, and retain
enough context to understand the result later.

For developers, this means mathematical, experimental, model-assisted, and
cryptographic work can share one way of handling dependencies, concurrency,
resources, and expected failures. For the people using those systems, it makes
creative history more legible: origins can remain visible, decisions can be
revisited, and a result does not have to lose its meaning as the system around
it changes.

The packages use [Effect](https://effect.website) because exact computations
eventually meet external services and changing runtimes. Effect keeps expected
failures, required services, concurrency, interruption, and resource lifetimes
visible in a program's type and composition. Calculations that do not need
those capabilities remain ordinary pure functions.

## How the pieces fit

Consider a program that helps turn someone's description into an interactive
scene. It may need to call a model, judge several outputs for quality, cost, and
latency, tune the program from those evaluations, save the accepted result,
attribute its contributors, protect private drafts, and present the text again
as the interface changes. Theoria gives each part of that process a clear
owner.

That progression—measure, explore, program, present, and preserve—is why these
packages live together. They share conventions and compose where their
responsibilities meet, but each is independently versioned and useful on its
own. An application can begin at the boundary it needs rather than adopting a
single framework.

### Measure what happened

[`@scenesystems/effect-math`](./packages/effect-math/README.md) supplies the
numerical vocabulary: linear algebra, calculus, geometry, probability,
statistics, distributions, special functions, and optimization. Pure
calculations stay pure. When a computation needs runtime precision policies,
diagnostics, or typed domain failures, those concerns become part of its Effect.

This is the layer for questions with a known calculation: What was the mean?
How far apart are these results? How much uncertainty is present?

### Explore what could work better

[`@scenesystems/effect-search`](./packages/effect-search/README.md) is for
questions where the result can be measured but the best configuration cannot
simply be derived. It explores continuous, integer, categorical, conditional,
and multi-objective search spaces with reproducible samplers, budgets,
constraints, persistence, and resume.

A study can balance several values rather than hiding them in one score—for
example, preserving a frontier of fast, inexpensive, and high-quality model
programs. `effect-search` builds on `effect-math` for its numerical work and
[`digest`](./packages/digest/README.md) to identify study material consistently.

### Turn model behavior into a program

[`@scenesystems/effect-dsp`](./packages/effect-dsp/README.md) treats work with
language models as programming rather than a collection of prompt strings.
Typed signatures describe inputs and outputs; modules compose behavior;
evaluation and tracing show what happened; optimizers improve instructions and
examples from measured results. It composes `effect-search`, `effect-math`, and
`digest` so an optimization has a mathematical basis and reproducible
artifacts.

[`@scenesystems/effect-inference`](./packages/effect-inference/README.md) owns a
different part of the problem: where model work runs and what actually ran. It
separates the requested runtime, the provider route selected before execution,
and the evidence observed afterward. Both packages meet at `@effect/ai`, so a
model program can change providers without making provider details its own
responsibility or erasing runtime provenance.

Together they help answer two separate questions: What should the model program
do, and what runtime produced this particular result?

### Prepare language for changing interfaces

[`@scenesystems/effect-text`](./packages/effect-text/README.md) prepares,
measures, and lays out multiline text. It performs segmentation, measurement,
and caching once, then keeps layout pure so the prepared text can be projected
again when width, obstacles, or presentation change.

Its main layout path stands on its own. Experimental calibration tools use
`effect-search` and `effect-math` to tune layout behavior against measured
examples—the same observation-and-improvement pattern applied to a visual
system.

### Preserve identity, authorship, and privacy

Three small cryptographic packages let applications keep exact artifacts and
human meaning separate:

- [`@scenesystems/digest`](./packages/digest/README.md) gives canonical data a
  stable content identity through strict JSON canonicalization and BLAKE3 or
  SHA-256. A digest says which exact artifact is present; the application still
  decides what that artifact means.
- [`@scenesystems/sign`](./packages/sign/README.md) provides classical and
  post-quantum signatures, direct verification, key agreement, and hybrid key
  encapsulation. It supplies the mechanism for attribution and authenticity;
  the application owns identity and authorization.
- [`@scenesystems/seal`](./packages/seal/README.md) protects private material
  with authenticated encryption and self-describing XChaCha20-Poly1305 or AES
  envelopes.

These packages work independently. Used together, they let a system identify
the exact version under discussion, verify a contribution without confusing a
signature for permission, and keep material private until it is ready to be
shared.

## The relationship to Scene

Scene is the product vision; Theoria is open computational work that supports
it. Today, `digest` and `sign` already support parts of Scene's content-identity
and cryptographic-evidence foundations. The scientific and model-programming
packages are independently useful libraries and are not yet one integrated
Scene runtime. They develop capabilities that persistent Worlds will need over
the longer arc: measurement, comparison, reproducibility, provenance, and
improvement.

The distinction is deliberate. This repository contains working public
libraries and their demonstrations. The full World model and the Scene
application live outside Theoria.

## Try a package

Every library is published independently under the `@scenesystems` scope, so
you can install only the capability you need. This `effect-search` program
looks for a function's minimum without requiring a gradient:

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

The objective can be any Effect: a calculation, benchmark, model call, or
request to another service. The seed makes the search reproducible. Each
package README has its own installation instructions, runnable examples, API
guide, and stability notes.

## Theoria app

[theoria.scenesystems.io](https://theoria.scenesystems.io/) is a working tour
of the libraries. Its demos execute the same package surfaces available to
consumers and show their typed inputs, results, failures, and runtime evidence.
The math, search, and text examples run without an external provider; the model
programming example runs when its server has a provider configured.

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
