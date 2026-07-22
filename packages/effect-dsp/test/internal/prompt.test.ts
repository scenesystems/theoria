/**
 * Prompt construction golden fixtures.
 */
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { Demo } from "@scenesystems/effect-dsp/Example"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { Effect, Schema } from "effect"
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

const paramsWithDemo = new ModuleParams({
  instructions: "Keep answers short.",
  demos: [
    new Demo({
      input: { question: "What is the capital of France?" },
      output: { answer: "Paris" }
    })
  ]
})

const paramsWithoutDemos = new ModuleParams({
  instructions: "Keep answers short.",
  demos: []
})

describe("internal/prompt", () => {
  it.effect("builds system + demo + final-input prompt using golden fixture", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const prompt = buildPrompt(
        qa,
        paramsWithDemo,
        { question: "What is the capital of Japan?" }
      )

      expect(prompt).toEqual(qaPromptWithDemo)
    }))

  it.effect("builds system + final-input prompt when no demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const prompt = buildPrompt(
        qa,
        paramsWithoutDemos,
        { question: "What is the capital of Japan?" }
      )

      expect(prompt).toEqual(qaPromptWithoutDemos)
    }))
})
