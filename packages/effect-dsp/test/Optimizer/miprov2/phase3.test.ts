/**
 * MIPROv2 Phase 3 Bayesian-search contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Data, Effect, Equal, Layer, Match, Option, Record as Rec, Ref, Schema } from "effect"
import { DemoCandidate, PredictorDemoCandidates } from "../../../src/optimizers/MIPROv2/bootstrap.js"
import { InstructionCandidate, PredictorInstructionCandidates } from "../../../src/optimizers/MIPROv2/propose.js"
import {
  evaluateTrial,
  EvaluateTrialOptions,
  makePhase3TrialRefs
} from "../../../src/optimizers/MIPROv2/runtime/evaluate.js"
import {
  BestAveragingCandidate,
  type Phase3Config,
  type Phase3DimensionIndex
} from "../../../src/optimizers/MIPROv2/runtime/model.js"
import { phase3TrialBudget, runPhase3Search } from "../../../src/optimizers/MIPROv2/search.js"

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
      const signature = yield* makeQaSignature()
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
      const signature = yield* makeQaSignature()
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
      expect(Arr.some(result.studyResult.trials, (trial) => Equal.equals(trial.prior, true))).toBe(true)
    }))

  it.effect("keeps the finite checkpoint candidate when trial zero scores NaN", () =>
    Effect.gen(function*() {
      const zeroIndex: Phase3DimensionIndex = 0
      const oneIndex: Phase3DimensionIndex = 1
      const baselineConfig = Rec.set(
        Rec.set(Rec.empty<string, Phase3DimensionIndex>(), "qa__demo", zeroIndex),
        "qa__instruction",
        zeroIndex
      )
      const nanConfig = Rec.set(
        Rec.set(Rec.empty<string, Phase3DimensionIndex>(), "qa__demo", oneIndex),
        "qa__instruction",
        oneIndex
      )
      const refs = yield* makePhase3TrialRefs
      const seenConfigs = yield* Ref.make(Arr.empty<Phase3Config>())
      const scores = yield* Ref.make<Schema.Array$<typeof Schema.Number>["Type"]>(Arr.make(Number.NaN, 1))

      yield* Ref.set(
        refs.bestAveragingRef,
        Option.some(new BestAveragingCandidate({ config: baselineConfig, score: 1 }))
      )
      yield* evaluateTrial(
        new EvaluateTrialOptions({
          config: nanConfig,
          refs,
          minibatchExamples: trainset,
          valset: trainset,
          fullEvalEvery: 1,
          emit: () => Effect.void,
          evaluateOn: (config) =>
            Ref.update(seenConfigs, (seen) => Arr.append(seen, config)).pipe(
              Effect.zipRight(
                Ref.modify(scores, (remaining) => Data.tuple(Arr.head(remaining), Arr.drop(remaining, 1))).pipe(
                  Effect.flatten
                )
              )
            )
        })
      )

      const seen = yield* Ref.get(seenConfigs)
      const checkpointConfig = Option.getOrElse(Arr.last(seen), () => nanConfig)

      expect(Equal.equals(checkpointConfig, baselineConfig)).toBe(true)
      expect(Arr.length(seen)).toBe(2)
    }))
})
