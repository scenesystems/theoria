/**
 * Fixture-backed DSPy parity contracts for MIPROv2 phase defaults and budgeting.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Effect, Layer, Match, Option, Ref, Schema } from "effect"

import { miprov2WithEvents } from "../../../src/optimizers/MIPROv2/index.js"
import { resolvePhase3Cadence } from "../../../src/optimizers/MIPROv2/runtime/budget.js"
import {
  DEFAULT_TIP_VOCABULARY,
  proposalMarker,
  resolveDiversityTemperature
} from "../../../src/optimizers/MIPROv2/runtime/policy.js"
import { phase3TrialBudget } from "../../../src/optimizers/MIPROv2/search.js"
import {
  loadFixture,
  MiproPhaseConfigFixtureSchema,
  MiproTipsVocabularyFixtureSchema,
  MiproTrialBudgetCasesFixtureSchema
} from "../../helpers/dspy-fixtures/index.js"

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

const trainset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

const phaseStartTag = (phase: string): string =>
  Match.value(phase).pipe(
    Match.when("phase1", () => "Phase1Started"),
    Match.when("phase2", () => "Phase2Started"),
    Match.orElse(() => "Phase3Started")
  )

const materializeTemplate = (
  template: string,
  predictorName: string,
  proposalIndex: number,
  seed: number
): string =>
  template
    .replace("{predictorName}", predictorName)
    .replace("{proposalIndex}", String(proposalIndex))
    .replace("{seed}", String(seed))

describe("MIPROv2 DSPy phase parity", () => {
  it.effect("matches fixture-defined phase defaults and orchestration order", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.mipro.phase-config")
      const fixture = yield* Schema.decodeUnknown(MiproPhaseConfigFixtureSchema)(rawFixture)

      const cadence = resolvePhase3Cadence({})

      expect(cadence.seed).toBe(fixture.payload.phase3CadenceDefaults.seed)
      expect(cadence.minibatchSize).toBe(fixture.payload.phase3CadenceDefaults.minibatchSize)
      expect(cadence.fullEvalEvery).toBe(fixture.payload.phase3CadenceDefaults.fullEvalEvery)

      const normalizedCadence = resolvePhase3Cadence({
        seed: -17.8,
        minibatchSize: 3.9,
        fullEvalEvery: Infinity
      })

      expect(normalizedCadence.seed).toBe(17)
      expect(normalizedCadence.minibatchSize).toBe(3)
      expect(normalizedCadence.fullEvalEvery).toBe(1)

      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const events = yield* Ref.make<ReadonlyArray<string>>(Arr.empty<string>())
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          prompt.includes("[miprov2-proposal:")
            ? "Use concise factual answers"
            : { answer: "Paris" }
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      yield* miprov2WithEvents(
        {
          module,
          trainset,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          numCandidates: 2,
          numInstructions: 2,
          trialBudget: 1,
          seed: 17
        },
        (event) => Ref.update(events, (tags) => Arr.append(tags, event._tag))
      ).pipe(Effect.provide(layer))

      const tags = yield* Ref.get(events)
      const orderedStartTags = Arr.map(fixture.payload.phaseOrder, phaseStartTag)

      yield* Effect.forEach(
        orderedStartTags,
        (tag) =>
          Effect.sync(() => {
            expect(tags).toContain(tag)
          }),
        { discard: true }
      )

      expect(tags.indexOf("Phase1Started")).toBeLessThan(tags.indexOf("Phase2Started"))
      expect(tags.indexOf("Phase2Started")).toBeLessThan(tags.indexOf("Phase3Started"))
    }))

  it.effect("matches fixture-defined tip vocabulary and marker template", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.mipro.tips-vocabulary")
      const fixture = yield* Schema.decodeUnknown(MiproTipsVocabularyFixtureSchema)(rawFixture)

      const expectedMarker = materializeTemplate(
        fixture.payload.proposalMarkerTemplate,
        "qa",
        3,
        11
      )

      expect(DEFAULT_TIP_VOCABULARY).toEqual(fixture.payload.defaultTips)
      expect(resolveDiversityTemperature()).toBe(fixture.payload.diversityTemperatureDefault)
      expect(proposalMarker("qa", 3, 11)).toBe(expectedMarker)
    }))

  it.effect("matches fixture-defined trial budget cases", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.mipro.trial-budget-cases")
      const fixture = yield* Schema.decodeUnknown(MiproTrialBudgetCasesFixtureSchema)(rawFixture)

      yield* Effect.forEach(fixture.payload.cases, (budgetCase) =>
        Effect.sync(() => {
          const computed = phase3TrialBudget({
            predictorCount: budgetCase.predictorCount,
            demoCandidateCount: budgetCase.demoCandidateCount,
            instructionCandidateCount: budgetCase.instructionCandidateCount,
            ...Option.match(Option.fromNullable(budgetCase.minimum), {
              onNone: () => ({}),
              onSome: (minimum) => ({ minimum })
            })
          })

          expect(computed).toBe(budgetCase.expectedBudget)
        }), { discard: true })
    }))
})
