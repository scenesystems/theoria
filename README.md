# Theoria

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Theoria is a collection of Effect-native libraries for building typed agent workflows, optimization studies, runtime provenance, text systems, and cryptographic artifact boundaries.

## Quick Start

Use the app as the front door, then open the generated package docs when you want to go deeper.

```sh
bun install
bun run app:theoria
bun run docs:packages -- --catalog
```

Open `http://127.0.0.1:3876` for the app and `http://127.0.0.1:3876/packages` for the projected package docs. If you prefer a background workflow, use `bun run app:theoria:tmux`. App-specific details live in [`apps/theoria/README.md`](./apps/theoria/README.md).

### One Meaningful Path

One representative path through the workspace is: declare a typed briefing task, route it through a Hugging Face runtime description, optimize the shape of the briefing, and fingerprint the resulting artifact.

```ts typecheck
import { Chunk, Effect, Match, Schema } from "effect"
import { Signature } from "effect-dsp"
import { durableFingerprint } from "@scenesystems/digest"
import * as HuggingFace from "effect-inference/HuggingFace"
import * as Runtime from "effect-inference/Runtime"
import { mean } from "effect-math/Statistics"
import { Sampler, SearchSpace, Study } from "effect-search"
import { Text } from "effect-text"

const program = Effect.gen(function* () {
  const briefingSignature = yield* Signature.make(
    "Prepare a research briefing for the next agent-assisted study run",
    {
      finding: Signature.describe(Schema.String, "The observed social or computational result"),
      audience: Signature.describe(Schema.String, "The reader who needs the briefing")
    },
    {
      summary: Signature.describe(Schema.String, "A concise summary grounded in the evidence")
    }
  )

  const finding =
    "Rotating facilitation increased evidence citation but reduced bridge formation across participant clusters during consensus building."
  const resolution = HuggingFace.HuggingFaceRoutedResolution.fromDescriptor(
    { artifact: { modelRef: "Qwen/Qwen2.5-72B-Instruct" } },
    "https://router.huggingface.co/v1"
  )
  const runtimeEvidence = Runtime.RuntimeEvidence.fromResolution({
    resolution,
    resolvedRuntime: {
      responseModel: "Qwen/Qwen2.5-72B-Instruct"
    }
  })

  const prepared = yield* Text.prepareWithSegments({
    text: [
      `Task: ${briefingSignature.instructions}`,
      `Finding: ${finding}`,
      "Audience: Research coordinator preparing the next agent-assisted study run."
    ].join("\n"),
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  const space = yield* SearchSpace.make({
    maxWidth: SearchSpace.int(160, 260, { step: 20 })
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 7 }),
    trials: 12,
    objective: ({ maxWidth }) =>
      Effect.sync(() => {
        const lines = Text.layoutLines(prepared, { maxWidth, lineHeight: 20 })
        const averageWidth = mean(Chunk.fromIterable(lines.map((line) => line.width)))

        return lines.reduce((score, line) => score + Math.abs(line.width - averageWidth), 0) + lines.length * 8
      })
  })

  const bestWidth = yield* Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => Effect.succeed(bestTrial.config.maxWidth)),
    Match.tag("MultiObjective", () => Effect.dieMessage("expected a single-objective study")),
    Match.exhaustive
  )

  const preview = Text.layoutLines(prepared, {
    maxWidth: bestWidth,
    lineHeight: 20
  })
    .map((line) => line.text)
    .join("\n")

  return yield* durableFingerprint({
    prompt: briefingSignature.instructions,
    preview,
    bestWidth,
    routeFamily: runtimeEvidence.resolvedRoute.route.family,
    responseModel: runtimeEvidence.resolvedRuntime.responseModel
  })
}).pipe(Effect.provide(Text.TextLayoutLive))

void program
```

## What's Here

- [`apps/theoria`](./apps/theoria/README.md) is the live proving consumer for the workspace and the easiest way to see the packages working together.
- Build typed language-model workflows with [`effect-dsp`](./packages/effect-dsp/README.md), optimize them with [`effect-search`](./packages/effect-search/README.md), and score or support them with [`effect-math`](./packages/effect-math/README.md).
- Keep runtime and rendering truth explicit with [`effect-inference`](./packages/effect-inference/README.md) and [`effect-text`](./packages/effect-text/README.md).
- Fingerprint, sign, and seal artifacts with [`@scenesystems/digest`](./packages/digest/README.md), [`@scenesystems/sign`](./packages/sign/README.md), and [`@scenesystems/seal`](./packages/seal/README.md).

## Go Deeper

- Start with [`apps/theoria/README.md`](./apps/theoria/README.md) if you want the integrated application story.
- Browse runnable examples under `packages/*/examples` when you want package-owned proofs instead of README snippets.
- Use `bun run docs:packages -- --catalog` to inspect the generated docs corpus and `bun run docs:packages -- --package effect-search --view agent` for a focused view.
- See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contributor workflow and repository rules.

## Development

The repository uses Bun and expects Node `>= 22`.

```sh
bun run check
bun run check:tests
bun run check:readmes
bun run lint
bun run test
bun run build
```

Use Bun filters when you only need one surface, for example `bun run --filter effect-search test` or `bun run --filter @theoria/theoria-app build`.

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
