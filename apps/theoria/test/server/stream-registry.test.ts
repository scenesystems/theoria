import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Stream } from "effect"

import { moduleSpecifiers, parseTypeScript, readProjectFile } from "@theoria/source-proof"
import { scenarioById } from "../../app/contracts/demo/dsp.js"
import { effectTextProjectionSteps } from "../../app/contracts/demo/text.js"
import { defaultDspRunRequest, type DspExecutionStory } from "../../app/server/demos/effect-dsp/runtime.js"
import { buildDspStageStories } from "../../app/server/demos/effect-dsp/stage-story.js"
import { streamElementsForStageStories } from "../../app/server/demos/effect-dsp/stream.js"
import { lookup } from "../../app/server/demos/registry.js"

const appRootUrl = new URL("../../", import.meta.url)

const dspStoryFixture: DspExecutionStory = {
  request: {
    scenarioId: defaultDspRunRequest.scenarioId,
    moduleType: "predict",
    optimizationBudget: 1
  },
  scenario: scenarioById(defaultDspRunRequest.scenarioId),
  provider: "mock-provider",
  model: "mock-model",
  durationMs: 12,
  baselineReport: {
    overallScores: { exactMatch: 0.5 },
    results: [{ index: 0, scores: { exactMatch: 0.5 }, durationMs: 3 }],
    totalExamples: 1,
    successCount: 0
  },
  optimizedReport: {
    overallScores: { exactMatch: 1 },
    results: [{ index: 0, scores: { exactMatch: 1 }, durationMs: 2 }],
    totalExamples: 1,
    successCount: 1
  },
  baselineScore: 0.5,
  optimizedScore: 1,
  optimization: {
    fallbackUsed: false,
    learnedDemos: 1,
    roundsUsed: 1,
    traceAcceptedCount: 1,
    traceRejectedCount: 0
  }
}

describe("Theoria Demo Stream Registry", () => {
  it.effect("collects the effect-text stream definition without circular initialization", () =>
    Effect.gen(function*() {
      const definition = lookup("effect-text")

      expect(Option.isSome(definition)).toBe(true)

      if (Option.isNone(definition)) {
        return
      }

      const elements = definition.value.streamElements(null)

      expect(elements).not.toBeNull()

      if (elements === null) {
        return
      }

      const collected = yield* Stream.runCollect(elements)
      const streamElements = Chunk.toReadonlyArray(collected)
      const sectionCount = streamElements.filter((element) => element._tag === "section").length
      const stepCount = streamElements.filter((element) => element._tag === "step").length
      const sectionTitles = streamElements.flatMap((element) =>
        element._tag === "section" ? [element.section.title] : []
      )

      expect(sectionCount).toBe(8)
      expect(stepCount).toBe(effectTextProjectionSteps("").length)
      expect(sectionTitles).toContain("React Surface")
      expect(sectionTitles).toContain("Browser Surface")
      expect(sectionTitles).toContain("Calibration")
      expect(streamElements.some((element) => element._tag === "cue")).toBe(true)
    }))

  it.effect("authors the effect-dsp stream with staged cues, canonical steps, and evidence sections", () =>
    Effect.gen(function*() {
      const definition = lookup("effect-dsp")

      expect(Option.isSome(definition)).toBe(true)

      const collected = yield* Stream.runCollect(streamElementsForStageStories(buildDspStageStories(dspStoryFixture)))
      const streamElements = Chunk.toReadonlyArray(collected)
      const stageEntries = streamElements.flatMap((element) =>
        element._tag === "cue" && element.cue._tag === "StageEnter" ? [element.cue.stageId] : []
      )
      const sectionTitles = streamElements.flatMap((element) =>
        element._tag === "section" ? [element.section.title] : []
      )

      expect(stageEntries).toEqual([
        "signature",
        "baseline",
        "optimizing",
        "optimized-eval",
        "comparison"
      ])
      expect(streamElements.some((element) => element._tag === "step")).toBe(true)
      expect(sectionTitles).toContain("Baseline Evaluation")
      expect(sectionTitles).toContain("Optimized Evaluation")
    }))

  it.effect("keeps the effect-dsp deep-dive runtime delegated to the effect-inference-backed provider service", () =>
    Effect.gen(function*() {
      const runtimePath = "app/server/demos/effect-dsp/runtime.ts"
      const source = yield* readProjectFile(appRootUrl, runtimePath)
      const parsed = parseTypeScript(runtimePath, source)
      const imports = moduleSpecifiers(parsed)

      expect(imports).toContain("./provider.js")
      expect(imports).not.toContain("@effect/ai-openai/OpenAiClient")
      expect(imports).not.toContain("@effect/ai-anthropic/AnthropicClient")
      expect(imports).not.toContain("@effect/ai-openrouter/OpenRouterClient")
    }).pipe(Effect.provide(BunContext.layer)))
})
