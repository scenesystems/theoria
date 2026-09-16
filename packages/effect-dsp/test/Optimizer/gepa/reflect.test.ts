/**
 * GEPA reflection preserves schema-owned examples and meaningful feedback.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number, Option, Order, Schema, String } from "effect"
import { MetricResult } from "../../../src/contracts/MetricResult.js"
import { encodePayload } from "../../../src/contracts/Payload.js"
import { ReflectiveDatasetSample } from "../../../src/optimizers/GEPA/model.js"
import {
  buildReflectiveDataset,
  buildReflectivePrompt,
  formatParseFailureFeedback,
  selectPredictorRoundRobin
} from "../../../src/optimizers/GEPA/reflect.js"
import {
  GepaReflectFormatFailureFeedbackFixtureSchema,
  GepaReflectPromptTemplateFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"

const Input = Schema.Struct({
  question: Schema.String,
  evidence: Schema.Array(Schema.Struct({ city: Schema.String, rank: Schema.NumberFromString }))
})
const Output = Schema.Struct({ answer: Schema.String, rejected: Schema.Array(Schema.String) })

const reflectiveSamples = Effect.gen(function*() {
  const inputs = yield* encodePayload(Input, {
    question: "What is the capital of France?",
    evidence: Arr.make({ city: "Paris", rank: 1 })
  })
  const generatedOutputs = yield* encodePayload(Output, { answer: "Lyon", rejected: Arr.make("Paris") })
  const expectedOutput = yield* encodePayload(Output, { answer: "Paris", rejected: Arr.make("Lyon") })
  return Arr.make(
    new ReflectiveDatasetSample({
      exampleId: "ex-1",
      predictorName: "qa",
      inputs,
      generatedOutputs,
      expectedOutput,
      metricResult: new MetricResult({ score: 0, feedback: " Needs correction " })
    }),
    new ReflectiveDatasetSample({
      exampleId: "ex-2",
      predictorName: "qa",
      inputs,
      generatedOutputs: expectedOutput,
      expectedOutput,
      metricResult: new MetricResult({ score: 1 })
    }),
    new ReflectiveDatasetSample({
      exampleId: "ex-3",
      predictorName: "qa",
      inputs,
      generatedOutputs,
      expectedOutput,
      metricResult: new MetricResult({ score: 0, feedback: "Must not hide parse failure" }),
      parseFailureStructure: "[[ ## answer ## ]]"
    })
  )
})

describe("GEPA reflective mutation", () => {
  it.effect("normalizes metric feedback and gives parse failure guidance precedence", () =>
    Effect.gen(function*() {
      const dataset = buildReflectiveDataset(yield* reflectiveSamples)
      expect(Arr.map(dataset, (example) => example.feedback)).toEqual(Arr.make(
        "Needs correction",
        "",
        "Your output failed to parse. Follow this structure:\n[[ ## answer ## ]]"
      ))
      expect(Arr.map(dataset, (example) => example.score)).toEqual(Arr.make(0, 1, 0))
    }))

  it.effect("cycles predictors and normalizes negative, fractional and non-finite iterations", () =>
    Effect.gen(function*() {
      const names = Arr.make("qa", "judge", "rewrite")
      const selected = Arr.map(Arr.range(0, 6), (iteration) => selectPredictorRoundRobin(names, iteration))
      expect(selected).toEqual(Arr.map(Arr.make("qa", "judge", "rewrite", "qa", "judge", "rewrite", "qa"), Option.some))
      expect(selectPredictorRoundRobin(Arr.empty<string>(), 0)).toEqual(Option.none())
      expect(selectPredictorRoundRobin(names, -1)).toEqual(Option.some("qa"))
      expect(selectPredictorRoundRobin(names, 4.9)).toEqual(Option.some("judge"))
      const infinity = yield* Schema.decode(Schema.NumberFromString)("Infinity")
      expect(selectPredictorRoundRobin(names, infinity)).toEqual(Option.some("qa"))
    }))

  it.effect("retains nested encoded evidence and output arrays in the golden prompt sections", () =>
    Effect.gen(function*() {
      const fixture = yield* loadFixture("dspy.gepa.reflect.prompt-template.basic").pipe(
        Effect.flatMap(Schema.decodeUnknown(GepaReflectPromptTemplateFixtureSchema))
      )
      const prompt = buildReflectivePrompt({
        predictorName: "qa",
        currentInstruction: fixture.payload.currentInstruction,
        examples: buildReflectiveDataset(yield* reflectiveSamples)
      })
      expect(prompt).toContain(fixture.payload.currentInstruction)
      expect(prompt).toContain("Target predictor: qa")
      expect(prompt).toContain(
        "\"question\":\"What is the capital of France?\",\"evidence\":[{\"city\":\"Paris\",\"rank\":\"1\"}]"
      )
      expect(prompt).toContain("\"answer\":\"Lyon\",\"rejected\":[\"Paris\"]")
      expect(prompt).toContain("\"answer\":\"Paris\",\"rejected\":[\"Lyon\"]")
      yield* Effect.forEach(
        fixture.payload.requiredSubstrings,
        (text) => Effect.sync(() => expect(prompt).toContain(text))
      )
      const positions = yield* Effect.forEach(
        fixture.payload.expectedSectionOrder,
        (section) => String.indexOf(section)(prompt)
      )
      expect(Arr.every(positions, Number.greaterThanOrEqualTo(0))).toBe(true)
      expect(positions).toEqual(Arr.sort(positions, Order.number))
    }))

  it.effect("uses the reference parse-failure feedback contract", () =>
    Effect.gen(function*() {
      const fixture = yield* loadFixture("dspy.gepa.reflect.format-failure-feedback").pipe(
        Effect.flatMap(Schema.decodeUnknown(GepaReflectFormatFailureFeedbackFixtureSchema))
      )
      const feedback = formatParseFailureFeedback(fixture.payload.structureInstruction)
      expect(feedback).toBe(fixture.payload.expectedFeedback)
      expect(String.startsWith(fixture.payload.expectedPrefix)(feedback)).toBe(true)
    }))
})
