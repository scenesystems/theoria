/**
 * MIPROv2 Phase 3 Bayesian-search contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Match, Ref } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import { DemoCandidate, PredictorDemoCandidates } from "../../../src/optimizers/MIPROv2/bootstrap.js"
import { InstructionCandidate, PredictorInstructionCandidates } from "../../../src/optimizers/MIPROv2/propose.js"
import { phase3TrialBudget, runPhase3Search } from "../../../src/optimizers/MIPROv2/search.js"
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

describe("MIPROv2 Phase 3", () => {
  it.effect("computes trial budget from MAX(2M·log(N), 3N/2) with optional minimum override", () =>
    Effect.gen(function*() {
      const budget = phase3TrialBudget({
        predictorCount: 2,
        demoCandidateCount: 4,
        instructionCandidateCount: 3
      })
      const boundedBudget = phase3TrialBudget({
        predictorCount: 2,
        demoCandidateCount: 4,
        instructionCandidateCount: 3,
        minimum: 8
      })

      expect(budget).toBe(6)
      expect(boundedBudget).toBe(8)
    }))

  it.effect("builds categorical search dimensions and enforces multivariate TPE", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const baselineParams = yield* Ref.get(module.params)
      const demoCandidates = Arr.make(
        new PredictorDemoCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "qa",
              kind: "zero-shot",
              params: new ModuleParams({
                instructions: baselineParams.instructions,
                demos: [],
                outputStrategy: "structured"
              })
            }),
            new DemoCandidate({
              predictorName: "qa",
              kind: "bootstrap-unshuffled",
              params: new ModuleParams({
                instructions: baselineParams.instructions,
                demos: [],
                outputStrategy: "structured"
              })
            })
          )
        })
      )
      const instructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "qa",
              instruction: baselineParams.instructions,
              tip: "baseline",
              cacheBustMarker: "[miprov2-proposal:qa:0:seed:1]",
              prompt: "baseline",
              isBaseline: true
            }),
            new InstructionCandidate({
              predictorName: "qa",
              instruction: "Use precise one-word capitals",
              tip: "precision",
              cacheBustMarker: "[miprov2-proposal:qa:1:seed:1]",
              prompt: "proposal",
              isBaseline: false
            })
          )
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* runPhase3Search({
        module,
        valset: trainset,
        metric: Metric.exactMatch("answer"),
        demoCandidates,
        instructionCandidates,
        trialBudget: 4,
        minibatchSize: 1,
        fullEvalEvery: 2,
        seed: 13
      }).pipe(Effect.provide(layer))

      expect(result.diagnostics.dimensionNames).toEqual(Arr.make("qa__demo", "qa__instruction"))
      expect(result.diagnostics.samplerKind).toBe("tpe")
      expect(result.diagnostics.multivariate).toBe(true)
    }))

  it.effect("tracks minibatch cadence, periodic full evals, and baseline-prior registration", () =>
    Effect.gen(function*() {
      const signature = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", signature)
      const baselineParams = yield* Ref.get(module.params)
      const demoCandidates = Arr.make(
        new PredictorDemoCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "qa",
              kind: "zero-shot",
              params: new ModuleParams({
                instructions: baselineParams.instructions,
                demos: [],
                outputStrategy: "structured"
              })
            }),
            new DemoCandidate({
              predictorName: "qa",
              kind: "bootstrap-shuffled",
              params: new ModuleParams({
                instructions: baselineParams.instructions,
                demos: [],
                outputStrategy: "structured"
              })
            })
          )
        })
      )
      const instructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "qa",
              instruction: baselineParams.instructions,
              tip: "baseline",
              cacheBustMarker: "[miprov2-proposal:qa:0:seed:1]",
              prompt: "baseline",
              isBaseline: true
            }),
            new InstructionCandidate({
              predictorName: "qa",
              instruction: "Always answer Paris for French capitals",
              tip: "anchor",
              cacheBustMarker: "[miprov2-proposal:qa:1:seed:1]",
              prompt: "proposal",
              isBaseline: false
            })
          )
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Match.value(prompt.includes("Always answer Paris")).pipe(
            Match.when(true, () => ({ answer: "Paris" })),
            Match.orElse(() => ({ answer: "Tokyo" }))
          )
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* runPhase3Search({
        module,
        valset: trainset,
        metric: Metric.exactMatch("answer"),
        demoCandidates,
        instructionCandidates,
        trialBudget: 6,
        minibatchSize: 1,
        fullEvalEvery: 3,
        seed: 41
      }).pipe(Effect.provide(layer))

      expect(result.diagnostics.priorTrialCount).toBe(1)
      expect(result.diagnostics.fullEvalTrialNumbers).toEqual(Arr.make(2, 5))
      expect(result.diagnostics.minibatchTrialNumbers).toEqual(Arr.make(0, 1, 2, 3, 4, 5))
      expect(Arr.some(result.studyResult.trials, (trial) => trial.prior === true)).toBe(true)
    }))
})
