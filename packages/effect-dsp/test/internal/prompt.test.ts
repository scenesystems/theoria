/**
 * Prompt construction golden fixtures.
 */
import * as Prompt from "@effect/ai/Prompt"
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Array as Arr, Effect, Schema } from "effect"
import { buildPrompt } from "../../src/internal/prompt/render.js"
import { qaPromptWithDemo, qaPromptWithoutDemos } from "../fixtures/prompt/qa-prompt.fixture.js"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

const paramsWithDemo = new ModuleParameters({
  instructions: "Keep answers short.",
  demos: Arr.make(
    new Demonstration({
      input: { question: "What is the capital of France?" },
      output: { answer: "Paris" }
    })
  )
})

const paramsWithoutDemos = new ModuleParameters({
  instructions: "Keep answers short.",
  demos: Arr.empty()
})

describe("internal/prompt", () => {
  it.effect("builds system + demo + final-input prompt using golden fixture", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const prompt = yield* buildPrompt(
        qa,
        paramsWithDemo,
        { question: "What is the capital of Japan?" }
      )

      expect(prompt).toEqual(Prompt.make(qaPromptWithDemo))
    }))

  it.effect("builds system + final-input prompt when no demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const prompt = yield* buildPrompt(
        qa,
        paramsWithoutDemos,
        { question: "What is the capital of Japan?" }
      )

      expect(prompt).toEqual(Prompt.make(qaPromptWithoutDemos))
    }))
})
