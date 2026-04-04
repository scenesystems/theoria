/**
 * GEPA reflective mutation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Order, Predicate, Record, Schema } from "effect"
import { FieldRecord } from "../../../src/contracts/FieldValue.js"
import { MetricResult } from "../../../src/contracts/MetricResult.js"
import { ReflectiveDatasetSample, ReflectiveExample } from "../../../src/optimizers/GEPA/model.js"
import {
  buildReflectiveDataset,
  buildReflectivePrompt,
  formatParseFailureFeedback,
  selectPredictorRoundRobin
} from "../../../src/optimizers/GEPA/reflect.js"
import {
  GepaReflectDatasetShapeFixtureSchema,
  GepaReflectFormatFailureFeedbackFixtureSchema,
  GepaReflectPromptTemplateFixtureSchema,
  loadFixture
} from "../../helpers/dspy-fixtures/index.js"

const ReflectiveDatasetSchema = Schema.Array(ReflectiveExample)

const decodeFieldRecord = Schema.decodeUnknownSync(FieldRecord)

const toFieldValueRecord = (record: Readonly<Record<string, unknown>>) =>
  decodeFieldRecord(
    Record.fromEntries(
      Arr.map(Record.toEntries(record), ([key, value]) => [
        key,
        Predicate.isString(value) || Predicate.isNumber(value) || Predicate.isBoolean(value) || value === null
          ? value
          : String(value)
      ])
    )
  )

const reflectiveSamples = Arr.make(
  new ReflectiveDatasetSample({
    exampleId: "ex-1",
    predictorName: "qa",
    inputs: { question: "What is the capital of France?" },
    generatedOutputs: { answer: "Lyon" },
    expectedOutput: { answer: "Paris" },
    metricResult: new MetricResult({ score: 0, feedback: " Needs correction " })
  }),
  new ReflectiveDatasetSample({
    exampleId: "ex-2",
    predictorName: "qa",
    inputs: { question: "What is the capital of Japan?" },
    generatedOutputs: { answer: "Tokyo" },
    expectedOutput: { answer: "Tokyo" },
    metricResult: new MetricResult({ score: 1, feedback: "" })
  }),
  new ReflectiveDatasetSample({
    exampleId: "ex-3",
    predictorName: "qa",
    inputs: { question: "What is the capital of Italy?" },
    generatedOutputs: { answer: "```json" },
    expectedOutput: { answer: "Rome" },
    metricResult: new MetricResult({ score: 0 }),
    parseFailureStructure: "[[ ## answer ## ]]"
  })
)

describe("GEPA reflective mutation", () => {
  it.effect("builds fixture-declared reflective datasets and preserves feedback normalization", () =>
    Effect.gen(function*() {
      const rawDatasetFixture = yield* loadFixture("dspy.gepa.reflect.dataset-shape")
      const datasetFixture = yield* Schema.decodeUnknown(GepaReflectDatasetShapeFixtureSchema)(rawDatasetFixture)
      const fixtureSamples = Arr.map(
        datasetFixture.payload.samples,
        (sample) =>
          new ReflectiveDatasetSample({
            ...sample,
            inputs: toFieldValueRecord(sample.inputs),
            generatedOutputs: toFieldValueRecord(sample.generatedOutputs),
            expectedOutput: toFieldValueRecord(sample.expectedOutput),
            metricResult: new MetricResult(sample.metricResult)
          })
      )
      const dataset = buildReflectiveDataset(fixtureSamples)
      const decoded = yield* Schema.decodeUnknown(ReflectiveDatasetSchema)(dataset)

      expect(decoded).toEqual(dataset)
      expect(dataset.length).toBe(datasetFixture.payload.samples.length)
      expect(Arr.map(dataset, (example) => example.feedback)).toEqual(
        Arr.map(datasetFixture.payload.samples, (sample) => sample.metricResult.feedback ?? "")
      )
    }))

  it.effect("builds reflective datasets that decode against the frozen ReflectiveExample schema", () =>
    Effect.gen(function*() {
      const dataset = buildReflectiveDataset(reflectiveSamples)
      const decoded = yield* Schema.decodeUnknown(ReflectiveDatasetSchema)(dataset)

      expect(decoded).toEqual(dataset)
      expect(Arr.get(dataset, 0).pipe(Option.map((example) => example.feedback))).toEqual(
        Option.some("Needs correction")
      )
      expect(Arr.get(dataset, 1).pipe(Option.map((example) => example.feedback))).toEqual(
        Option.some("")
      )
      expect(Arr.get(dataset, 2).pipe(Option.map((example) => example.feedback))).toEqual(
        Option.some(formatParseFailureFeedback("[[ ## answer ## ]]"))
      )
    }))

  it.effect("selects predictors in deterministic round-robin order", () =>
    Effect.gen(function*() {
      const predictorNames = Arr.make("qa", "judge", "rewrite")
      const selected = Arr.map(
        Arr.makeBy(7, (iteration) => iteration),
        (iteration) => Option.getOrElse(selectPredictorRoundRobin(predictorNames, iteration), () => "[none]")
      )

      expect(selected).toEqual([
        "qa",
        "judge",
        "rewrite",
        "qa",
        "judge",
        "rewrite",
        "qa"
      ])
      expect(selectPredictorRoundRobin(Arr.empty<string>(), 0)).toEqual(Option.none())
    }))

  it.effect("renders reflection prompts with instruction and explicit input/output/feedback sections", () =>
    Effect.gen(function*() {
      const rawDatasetFixture = yield* loadFixture("dspy.gepa.reflect.dataset-shape")
      const datasetFixture = yield* Schema.decodeUnknown(GepaReflectDatasetShapeFixtureSchema)(rawDatasetFixture)
      const rawPromptFixture = yield* loadFixture("dspy.gepa.reflect.prompt-template.basic")
      const promptFixture = yield* Schema.decodeUnknown(GepaReflectPromptTemplateFixtureSchema)(rawPromptFixture)
      const dataset = buildReflectiveDataset(reflectiveSamples)
      const prompt = buildReflectivePrompt({
        predictorName: datasetFixture.payload.predictorName,
        currentInstruction: promptFixture.payload.currentInstruction,
        examples: dataset
      })

      expect(prompt.includes(promptFixture.payload.currentInstruction)).toBe(true)
      expect(prompt.includes("Target predictor: qa")).toBe(true)
      expect(prompt.includes("question: What is the capital of France?")).toBe(true)
      expect(prompt.includes("answer: Paris")).toBe(true)

      yield* Effect.forEach(
        promptFixture.payload.requiredSubstrings,
        (value) =>
          Effect.sync(() => {
            expect(prompt.includes(value)).toBe(true)
          }),
        { discard: true }
      )

      const sectionPositions = Arr.map(
        promptFixture.payload.expectedSectionOrder,
        (section) => prompt.indexOf(section)
      )

      expect(Arr.every(sectionPositions, (position) => position >= 0)).toBe(true)
      expect(sectionPositions).toEqual(Arr.sort(sectionPositions, Order.number))
    }))

  it.effect("uses the committed format-failure feedback contract", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.gepa.reflect.format-failure-feedback")
      const fixture = yield* Schema.decodeUnknown(GepaReflectFormatFailureFeedbackFixtureSchema)(rawFixture)
      const feedback = formatParseFailureFeedback(fixture.payload.structureInstruction)

      expect(feedback).toBe(fixture.payload.expectedFeedback)
      expect(feedback.startsWith(fixture.payload.expectedPrefix)).toBe(true)
    }))
})
