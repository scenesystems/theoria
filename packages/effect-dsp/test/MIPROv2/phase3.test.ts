/**
 * MIPROv2 Phase 3 Bayesian-search contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { AllTrialsFailed } from "@scenesystems/effect-dsp/DspError"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Effect, Equal, Layer, Match, Option, Record as Rec, Ref, Schema, String, Struct } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { bestFullEvaluation, nextFullEvaluation, ToldEvaluation } from "../../src/internal/miprov2/phase3State.js"
import * as Sampling from "../../src/internal/miprov2/sampling.js"
import { TrialEvaluation } from "../../src/MIPROv2.js"
import {
  DemoCandidate,
  InstructionCandidate,
  PredictorDemoCandidates,
  PredictorInstructionCandidates
} from "../../src/MIPROv2Candidates.js"
import { Options, run, trialBudget } from "../../src/MIPROv2Search.js"

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
  new Example({ input: { question: "What is the capital of France?" }, labels: Option.some({ answer: "Paris" }) }),
  new Example({ input: { question: "What is the capital of Japan?" }, labels: Option.some({ answer: "Tokyo" }) })
)

describe("MIPROv2 Phase 3", () => {
  it.effect("nonpositive trial budgets evaluate only the baseline and preserve the RNG stream", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("qa", yield* makeQaSignature())
      const original = yield* Ref.get(module.parameters)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const rng = yield* PseudoRandom.makeCPython(9)
      const before = yield* rng.snapshot
      const instructions = [
        new PredictorInstructionCandidates({
          predictorName: "qa",
          candidates: [
            new InstructionCandidate({
              predictorName: "qa",
              instruction: original.instructions,
              tip: "baseline",
              rolloutId: Option.none(),
              prompt: "baseline",
              isBaseline: true
            })
          ]
        })
      ]
      yield* Effect.forEach([0, -2], (budget) =>
        Effect.gen(function*() {
          const result = yield* run(
            new Options({
              module,
              valset: trainset,
              metric: Metric.exactMatch("answer"),
              demoCandidates: [],
              instructionCandidates: instructions,
              trialBudget: budget,
              minibatchSize: 1
            })
          ).pipe(
            Effect.provideService(LanguageModel.LanguageModel, mock.service),
            Effect.provideService(Sampling.Current, Option.some(rng))
          )
          expect(result.diagnostics.evaluations).toHaveLength(1)
          expect(result.diagnostics.bestScore).toBe(0.5)
          expect(result.diagnostics.bestTrial).toBe(0)
          expect(result.parameters.qa).toEqual(original)
          expect(yield* rng.snapshot).toEqual(before)
        }))
    }))

  it.effect("rounds percentage scores using Python half-even and the exact binary input", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("qa", yield* makeQaSignature())
      const original = yield* Ref.get(module.parameters)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      yield* Effect.forEach([
        { score: 0.00125, percent: 0.12 },
        { score: 0.00625, percent: 0.62 },
        { score: 0.02675, percent: 2.67 },
        { score: 0.50005, percent: 50.01 },
        { score: -0.00125, percent: -0.12 }
      ], ({ score, percent }) =>
        Effect.gen(function*() {
          const result = yield* run(
            new Options({
              module,
              valset: Arr.take(trainset, 1),
              metric: Metric.withFeedback(() =>
                Effect.succeed(new Metric.Score({ value: score, feedback: Option.none() }))
              ),
              demoCandidates: [],
              instructionCandidates: [
                new PredictorInstructionCandidates({
                  predictorName: "qa",
                  candidates: [
                    new InstructionCandidate({
                      predictorName: "qa",
                      instruction: original.instructions,
                      tip: "baseline",
                      rolloutId: Option.none(),
                      prompt: "baseline",
                      isBaseline: true
                    })
                  ]
                })
              ],
              trialBudget: 1,
              minibatch: false
            })
          ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
          expect(result.diagnostics.baselineObjective).toBe(percent / 100)
        }))
    }))

  it.effect("computes trial budget from MAX(2M·log(N), 3N/2) with optional minimum override", () =>
    Effect.gen(function*() {
      const budget = trialBudget({
        predictorCount: 2,
        demoCandidateCount: 4,
        instructionCandidateCount: 3
      })
      const boundedBudget = trialBudget({
        predictorCount: 2,
        demoCandidateCount: 4,
        instructionCandidateCount: 3,
        minimum: 20
      })

      expect(budget).toBe(16)
      expect(boundedBudget).toBe(20)
    }))

  it.effect("builds categorical search dimensions and enforces multivariate TPE", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const baselineParameters = yield* Ref.get(module.parameters)
      const demoCandidates = Arr.make(
        new PredictorDemoCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "qa",
              kind: "zero-shot",
              parameters: new ModuleParameters({
                instructions: baselineParameters.instructions,
                demos: Arr.empty(),
                outputStrategy: "structured"
              })
            }),
            new DemoCandidate({
              predictorName: "qa",
              kind: "bootstrap-unshuffled",
              parameters: new ModuleParameters({
                instructions: baselineParameters.instructions,
                demos: Arr.empty(),
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
              instruction: baselineParameters.instructions,
              tip: "baseline",
              rolloutId: Option.none(),
              prompt: "baseline",
              isBaseline: true
            }),
            new InstructionCandidate({
              predictorName: "qa",
              instruction: "Use precise one-word capitals",
              tip: "precision",
              rolloutId: Option.some(1),
              prompt: "proposal",
              isBaseline: false
            })
          )
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* run(
        new Options({
          module,
          valset: trainset,
          metric: Metric.withFeedback((example, prediction, context) =>
            Effect.gen(function*() {
              expect(yield* Ref.get(module.parameters)).toEqual(baselineParameters)
              return yield* Metric.exactMatch("answer").score(example, prediction, context)
            }), "immutable"),
          demoCandidates,
          instructionCandidates,
          trialBudget: 4,
          minibatchSize: 1,
          fullEvalEvery: 2,
          seed: 13
        })
      ).pipe(Effect.provide(layer))

      expect(result.diagnostics.dimensionNames).toEqual(Arr.make("0_predictor_instruction", "0_predictor_demos"))
      expect(result.diagnostics.samplerKind).toBe("tpe")
      expect(result.diagnostics.multivariate).toBe(true)
    }))

  it.effect("preflights a nonzero incompatible child demo before mutating the module tree", () =>
    Effect.gen(function*() {
      const rootSignature = yield* makeQaSignature()
      const childSignature = yield* Signature.make(
        "Draft a supporting fact",
        {
          query: Signature.describe(Schema.String, "Question reformulated for the child")
        },
        {
          fact: Signature.describe(Schema.String, "Supporting fact")
        }
      )
      const child = yield* Module.predict("child", childSignature)
      const root = yield* Module.compose(
        new Module.ComposeOptions({
          name: "root",
          signature: rootSignature,
          subModules: Rec.singleton("child", child),
          forward: ({ input }) =>
            child.forward({ query: input.question }).pipe(
              Effect.map((result) => ({ answer: result.fact }))
            )
        })
      )
      const originalRootParameters = yield* Ref.get(root.parameters)
      const originalChildParameters = yield* Ref.get(child.parameters)
      const demoCandidates = Arr.make(
        new PredictorDemoCandidates({
          predictorName: "child",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "child",
              kind: "zero-shot",
              parameters: originalChildParameters
            }),
            new DemoCandidate({
              predictorName: "child",
              kind: "bootstrap-unshuffled",
              parameters: new ModuleParameters({
                instructions: originalChildParameters.instructions,
                demos: Arr.make(
                  new Demonstration({
                    input: { question: "What is the capital of France?" },
                    output: { answer: "Paris" }
                  })
                ),
                outputStrategy: originalChildParameters.outputStrategy
              })
            })
          )
        })
      )
      const instructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "child",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "child",
              instruction: originalChildParameters.instructions,
              tip: "baseline",
              rolloutId: Option.none(),
              prompt: "baseline",
              isBaseline: true
            })
          )
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ fact: "Paris", answer: "Paris" }))
      const failure = yield* run(
        new Options({
          module: root,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          demoCandidates,
          instructionCandidates,
          trialBudget: 1,
          seed: 17
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const report = yield* Schema.decodeUnknownEffect(AllTrialsFailed)(failure)

      expect(report.message).toContain("destination contract for predictor 'child'")
      expect(yield* Ref.get(mock.calls)).toEqual(Arr.empty())
      expect(yield* Ref.get(root.parameters)).toBe(originalRootParameters)
      expect(yield* Ref.get(child.parameters)).toBe(originalChildParameters)
    }))

  it.effect("rejects ambiguous, unknown, and internally mismatched candidate identities", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const originalParameters = yield* Ref.get(module.parameters)
      const demoSet = new PredictorDemoCandidates({
        predictorName: "qa",
        candidates: Arr.make(
          new DemoCandidate({
            predictorName: "qa",
            kind: "zero-shot",
            parameters: originalParameters
          })
        )
      })
      const instructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "qa",
              instruction: originalParameters.instructions,
              tip: "baseline",
              rolloutId: Option.none(),
              prompt: "baseline",
              isBaseline: true
            })
          )
        })
      )
      const mismatchedInstructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "other",
              instruction: originalParameters.instructions,
              tip: "baseline",
              rolloutId: Option.none(),
              prompt: "baseline",
              isBaseline: true
            })
          )
        })
      )
      const unknownDemoSet = new PredictorDemoCandidates({
        predictorName: "other",
        candidates: Arr.make(
          new DemoCandidate({
            predictorName: "other",
            kind: "zero-shot",
            parameters: originalParameters
          })
        )
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const ambiguous = yield* run(
        new Options({
          module,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          demoCandidates: Arr.make(demoSet, demoSet),
          instructionCandidates,
          trialBudget: 1,
          seed: 19
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const mismatched = yield* run(
        new Options({
          module,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          demoCandidates: Arr.make(demoSet),
          instructionCandidates: mismatchedInstructionCandidates,
          trialBudget: 1,
          seed: 19
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const unknown = yield* run(
        new Options({
          module,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          demoCandidates: Arr.make(demoSet, unknownDemoSet),
          instructionCandidates,
          trialBudget: 1,
          seed: 19
        })
      ).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const ambiguousReport = yield* Schema.decodeUnknownEffect(AllTrialsFailed)(ambiguous)
      const mismatchedReport = yield* Schema.decodeUnknownEffect(AllTrialsFailed)(mismatched)
      const unknownReport = yield* Schema.decodeUnknownEffect(AllTrialsFailed)(unknown)

      expect(ambiguousReport.message).toContain("Ambiguous phase-3 demo candidates for predictor 'qa'")
      expect(mismatchedReport.message).toContain("identifies predictor 'other'")
      expect(unknownReport.message).toContain("Unknown phase-3 demo candidates for predictor 'other'")
      expect(yield* Ref.get(mock.calls)).toEqual(Arr.empty())
      expect(yield* Ref.get(module.parameters)).toBe(originalParameters)
    }))

  it.effect("tracks minibatch cadence, periodic full evals, and baseline-prior registration", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const baselineParameters = yield* Ref.get(module.parameters)
      const demoCandidates = Arr.make(
        new PredictorDemoCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "qa",
              kind: "zero-shot",
              parameters: new ModuleParameters({
                instructions: baselineParameters.instructions,
                demos: Arr.empty(),
                outputStrategy: "structured"
              })
            }),
            new DemoCandidate({
              predictorName: "qa",
              kind: "bootstrap-shuffled",
              parameters: new ModuleParameters({
                instructions: baselineParameters.instructions,
                demos: Arr.empty(),
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
              instruction: baselineParameters.instructions,
              tip: "baseline",
              rolloutId: Option.none(),
              prompt: "baseline",
              isBaseline: true
            }),
            new InstructionCandidate({
              predictorName: "qa",
              instruction: "Always answer Paris for French capitals",
              tip: "anchor",
              rolloutId: Option.some(1),
              prompt: "proposal",
              isBaseline: false
            })
          )
        })
      )
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.map((prompt) =>
          Match.value(String.includes("Always answer Paris")(prompt)).pipe(
            Match.when(true, () => ({ answer: "Paris" })),
            Match.orElse(() => ({ answer: "Tokyo" }))
          )
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* run(
        new Options({
          module,
          valset: trainset,
          metric: Metric.exactMatch("answer"),
          demoCandidates,
          instructionCandidates,
          trialBudget: 6,
          minibatchSize: 1,
          fullEvalEvery: 3,
          seed: 41
        })
      ).pipe(Effect.provide(layer))

      expect(result.diagnostics.priorTrialCount).toBe(1)
      expect(result.diagnostics.fullEvalTrialNumbers).toEqual(Arr.make(0, 4, 8))
      expect(result.diagnostics.minibatchTrialNumbers).toEqual(Arr.make(1, 2, 3, 5, 6, 7))
      expect(
        Arr.some(Arr.fromIterable(result.optimizationResult.trials), (trial) => Equal.equals(trial.trialNumber, 0))
      ).toBe(true)
    }))

  it.effect("ranks repeated configs by mean, permits baseline replay, and permanently skips checkpoints", () =>
    Effect.gen(function*() {
      const row = (trial: number, choice: number, score: number, percent: number, fullValidation = false) =>
        new ToldEvaluation({
          evaluation: new TrialEvaluation({
            trial,
            config: { instruction: choice },
            score,
            fullValidation,
            sampled: !fullValidation
          }),
          percent
        })
      const history = [row(0, 0, 0.9, 90, true), row(1, 1, 1, 100), row(2, 1, 0, 0), row(3, 0, 0.7, 70)]
      expect(yield* nextFullEvaluation(history)).toEqual({ instruction: 0 })
      const checkpointed = Arr.append(history, row(4, 0, 0, 0, true))
      expect(yield* nextFullEvaluation(Arr.append(checkpointed, row(5, 0, 1, 100)))).toEqual({ instruction: 1 })
      expect(Option.getOrThrow(bestFullEvaluation(Arr.map(checkpointed, (told) => told.evaluation))).trial).toBe(0)
    }))

  it.effect("mean and full-score ties retain the first observed combination, not the latest", () =>
    Effect.gen(function*() {
      const rows = Arr.map([3, 1, 3, 3], (instruction, trial) =>
        new TrialEvaluation({
          trial,
          config: { instruction },
          score: 0.8,
          fullValidation: false,
          sampled: true
        }))
      expect(yield* nextFullEvaluation(Arr.map(rows, (evaluation) => new ToldEvaluation({ evaluation, percent: 80 }))))
        .toEqual({ instruction: 3 })
      const full = Arr.map(rows, (row) => new TrialEvaluation(Struct.assign(row, { fullValidation: true })))
      expect(Option.getOrThrow(bestFullEvaluation(full)).trial).toBe(0)
    }))
})
