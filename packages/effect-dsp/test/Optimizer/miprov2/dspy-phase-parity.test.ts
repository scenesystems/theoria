/**
 * Fixture-backed DSPy parity contracts for MIPROv2 phase defaults and budgeting.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Match, Ref, Schema } from "effect"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"

import { miprov2WithEvents } from "../../../src/optimizers/MIPROv2/index.js"
import { resolvePhase3Cadence } from "../../../src/optimizers/MIPROv2/runtime/budget.js"
import {
  DEFAULT_TIP_VOCABULARY,
  proposalMarker,
  resolveDiversityTemperature
} from "../../../src/optimizers/MIPROv2/runtime/policy.js"
import { phase3TrialBudget } from "../../../src/optimizers/MIPROv2/search.js"
import {
  FixtureRegistry,
  MiproPhaseConfigFixtureSchema,
  MiproTipsVocabularyFixtureSchema,
  MiproTrialBudgetCasesFixtureSchema
} from "../../helpers/dspy-fixtures/index.js"
import { conciseFactsQaSignature } from "../../helpers/qa-signatures.js"

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
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.mipro.phase-config")
      const fixture = yield* Schema.decodeUnknown(MiproPhaseConfigFixtureSchema)(rawFixture)

      const cadence = resolvePhase3Cadence({})

      expect(cadence.seed).toBe(fixture.payload.phase3CadenceDefaults.seed)
      expect(cadence.minibatchSize).toBe(fixture.payload.phase3CadenceDefaults.minibatchSize)
      expect(cadence.fullEvalEvery).toBe(fixture.payload.phase3CadenceDefaults.fullEvalEvery)
      expect(fixture.payload.phase3Sampler.kind).toBe("tpe")
      expect(fixture.payload.phase3Sampler.multivariate).toBe(true)

      const signature = yield* conciseFactsQaSignature
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
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.mipro.tips-vocabulary")
      const fixture = yield* Schema.decodeUnknown(MiproTipsVocabularyFixtureSchema)(rawFixture)

      const expectedMarker = materializeTemplate(
        fixture.payload.proposalMarkerTemplate,
        "qa",
        3,
        11
      )

      expect(DEFAULT_TIP_VOCABULARY).toEqual(fixture.payload.defaultTips)
      expect(resolveDiversityTemperature()).toBe(fixture.payload.diversityTemperatureDefault)
      expect(fixture.payload.baselineTip).toBe("baseline")
      expect(proposalMarker("qa", 3, 11)).toBe(expectedMarker)
    }))

  it.effect("matches fixture-defined trial budget cases", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const rawFixture = yield* registry.load("dspy.mipro.trial-budget-cases")
      const fixture = yield* Schema.decodeUnknown(MiproTrialBudgetCasesFixtureSchema)(rawFixture)

      expect(fixture.payload.cases.length).toBeGreaterThan(0)

      yield* Effect.forEach(fixture.payload.cases, (budgetCase) =>
        Effect.sync(() => {
          const computed = phase3TrialBudget({
            predictorCount: budgetCase.predictorCount,
            demoCandidateCount: budgetCase.demoCandidateCount,
            instructionCandidateCount: budgetCase.instructionCandidateCount,
            ...budgetCase.minimum === null ? {} : { minimum: budgetCase.minimum }
          })

          expect(computed).toBe(budgetCase.expectedBudget)
        }), { discard: true })
    }))
})
