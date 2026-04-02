import type { Card } from "../../app/contracts/card.js"
import { DemoExecutionError } from "../../app/contracts/demo-error.js"
import type { ProgramPreview } from "../../app/contracts/program-preview.js"
import type { RunData } from "../../app/contracts/run.js"

export const effectTextCardFixture: Card = {
  id: "effect-text",
  title: "effect-text",
  packageName: "effect-text",
  description: "Effect-native text preparation, measurement, and greedy multiline layout",
  useCase: "Deterministic semantic text layout projection for renderer authority.",
  summary: "Benchmark text preparation reuse and layout fidelity across a multi-domain corpus.",
  runLabel: "Run Benchmark",
  interactiveLabel: "Live Reflow",
  deepDivePath: "/demos/effect-text",
  group: "effect",
  releaseState: "published",
  version: "0.0.0",
  npmUrl: "https://www.npmjs.com/package/effect-text",
  repoUrl: "https://github.com/scenesystems/theoria/tree/main/packages/effect-text",
  license: "MIT"
}

export const errorFixture = new DemoExecutionError({
  code: "execution-failed",
  message: "fixture failure",
  retryable: true
})

export const runDataFixture = (summary: string): RunData => ({
  id: "effect-text",
  packageName: "effect-text",
  summary,
  durationMs: 3,
  program: {
    files: [{
      language: "ts",
      entry: "server/run.ts",
      name: "run.ts",
      source: "export const run = Effect.succeed('ok')"
    }]
  },
  sections: [
    {
      title: "Performance",
      items: [
        {
          _tag: "Comparison",
          label: "Projection runtime",
          baseline: 2,
          improved: 1,
          unit: "ms",
          direction: "lower-is-better"
        }
      ]
    },
    {
      title: "Corpus",
      items: [
        { _tag: "Text", label: "Corpus entries", value: "1" }
      ]
    }
  ]
})

export const programPreviewFixture: ProgramPreview = {
  id: "effect-text",
  card: effectTextCardFixture,
  summary: effectTextCardFixture.summary,
  program: {
    files: [{
      language: "ts",
      entry: "server/run.ts",
      name: "run.ts",
      source: "export const run = Effect.succeed('ok')"
    }]
  }
}
