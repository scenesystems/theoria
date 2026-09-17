/**
 * MIPROv2 Phase 3 Bayesian-search contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import { AllTrialsFailed } from "@scenesystems/effect-dsp/DspError"
import { Example } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import {
  Array as Arr,
  Data,
  Effect,
  Equal,
  Layer,
  Match,
  Number as Num,
  Option,
  Record as Rec,
  Ref,
  Schema,
  String
} from "effect"
import { makeTrialRefs } from "../../src/internal/miprov2/phase3State.js"
import { evaluateBaseline, evaluateTrial, EvaluateTrialOptions } from "../../src/internal/miprov2/runtime/evaluate.js"
import {
  BestAveragingCandidate,
  Phase3Config,
  type Phase3DimensionIndex
} from "../../src/internal/miprov2/runtime/model.js"
import {
  DemoCandidate,
  InstructionCandidate,
  PredictorDemoCandidates,
  PredictorInstructionCandidates
} from "../../src/MIPROv2Candidates.js"
import { run, trialBudget } from "../../src/MIPROv2Search.js"

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
      const budget = trialBudget({
        predictorCount: 2,
        demoCandidateCount: 4,
        instructionCandidateCount: 3
      })
      const boundedBudget = trialBudget({
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
              params: new ModuleParameters({
                instructions: baselineParams.instructions,
                demos: Arr.empty(),
                outputStrategy: "structured"
              })
            }),
            new DemoCandidate({
              predictorName: "qa",
              kind: "bootstrap-unshuffled",
              params: new ModuleParameters({
                instructions: baselineParams.instructions,
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
        MockLanguageModel.succeed({ answer: "Paris" })
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* run({
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
      const root = yield* Module.compose({
        name: "root",
        signature: rootSignature,
        subModules: Rec.singleton("child", child),
        forward: ({ input }) =>
          child.forward({ query: input.question }).pipe(
            Effect.map((result) => ({ answer: result.fact }))
          )
      })
      const originalRootParams = yield* Ref.get(root.params)
      const originalChildParams = yield* Ref.get(child.params)
      const demoCandidates = Arr.make(
        new PredictorDemoCandidates({
          predictorName: "root",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "root",
              kind: "zero-shot",
              params: originalRootParams
            })
          )
        }),
        new PredictorDemoCandidates({
          predictorName: "child",
          candidates: Arr.make(
            new DemoCandidate({
              predictorName: "child",
              kind: "zero-shot",
              params: originalChildParams
            }),
            new DemoCandidate({
              predictorName: "child",
              kind: "bootstrap-unshuffled",
              params: new ModuleParameters({
                instructions: originalChildParams.instructions,
                demos: Arr.make(
                  new Demonstration({
                    input: { question: "What is the capital of France?" },
                    output: { answer: "Paris" }
                  })
                ),
                outputStrategy: originalChildParams.outputStrategy
              })
            })
          )
        })
      )
      const instructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "root",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "root",
              instruction: originalRootParams.instructions,
              tip: "baseline",
              cacheBustMarker: "[miprov2-proposal:root:0:seed:1]",
              prompt: "baseline",
              isBaseline: true
            })
          )
        }),
        new PredictorInstructionCandidates({
          predictorName: "child",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "child",
              instruction: originalChildParams.instructions,
              tip: "baseline",
              cacheBustMarker: "[miprov2-proposal:child:0:seed:1]",
              prompt: "baseline",
              isBaseline: true
            })
          )
        })
      )
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ fact: "Paris", answer: "Paris" }))
      const failure = yield* run({
        module: root,
        valset: trainset,
        metric: Metric.exactMatch("answer"),
        demoCandidates,
        instructionCandidates,
        trialBudget: 1,
        seed: 17
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const report = yield* Schema.decodeUnknown(AllTrialsFailed)(failure)

      expect(report.message).toContain("destination contract for predictor 'child'")
      expect(yield* Ref.get(mock.calls)).toEqual(Arr.empty())
      expect(yield* Ref.get(root.params)).toBe(originalRootParams)
      expect(yield* Ref.get(child.params)).toBe(originalChildParams)
    }))

  it.effect("rejects ambiguous, unknown, and internally mismatched candidate identities", () =>
    Effect.gen(function*() {
      const signature = yield* makeQaSignature()
      const module = yield* Module.predict("qa", signature)
      const originalParams = yield* Ref.get(module.params)
      const demoSet = new PredictorDemoCandidates({
        predictorName: "qa",
        candidates: Arr.make(
          new DemoCandidate({
            predictorName: "qa",
            kind: "zero-shot",
            params: originalParams
          })
        )
      })
      const instructionCandidates = Arr.make(
        new PredictorInstructionCandidates({
          predictorName: "qa",
          candidates: Arr.make(
            new InstructionCandidate({
              predictorName: "qa",
              instruction: originalParams.instructions,
              tip: "baseline",
              cacheBustMarker: "[miprov2-proposal:qa:0:seed:1]",
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
              instruction: originalParams.instructions,
              tip: "baseline",
              cacheBustMarker: "[miprov2-proposal:other:0:seed:1]",
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
            params: originalParams
          })
        )
      })
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "Paris" }))
      const ambiguous = yield* run({
        module,
        valset: trainset,
        metric: Metric.exactMatch("answer"),
        demoCandidates: Arr.make(demoSet, demoSet),
        instructionCandidates,
        trialBudget: 1,
        seed: 19
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const mismatched = yield* run({
        module,
        valset: trainset,
        metric: Metric.exactMatch("answer"),
        demoCandidates: Arr.make(demoSet),
        instructionCandidates: mismatchedInstructionCandidates,
        trialBudget: 1,
        seed: 19
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const unknown = yield* run({
        module,
        valset: trainset,
        metric: Metric.exactMatch("answer"),
        demoCandidates: Arr.make(demoSet, unknownDemoSet),
        instructionCandidates,
        trialBudget: 1,
        seed: 19
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const ambiguousReport = yield* Schema.decodeUnknown(AllTrialsFailed)(ambiguous)
      const mismatchedReport = yield* Schema.decodeUnknown(AllTrialsFailed)(mismatched)
      const unknownReport = yield* Schema.decodeUnknown(AllTrialsFailed)(unknown)

      expect(ambiguousReport.message).toContain("Ambiguous phase-3 demo candidates for predictor 'qa'")
      expect(mismatchedReport.message).toContain("identifies predictor 'other'")
      expect(unknownReport.message).toContain("Unknown phase-3 demo candidates for predictor 'other'")
      expect(yield* Ref.get(mock.calls)).toEqual(Arr.empty())
      expect(yield* Ref.get(module.params)).toBe(originalParams)
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
              params: new ModuleParameters({
                instructions: baselineParams.instructions,
                demos: Arr.empty(),
                outputStrategy: "structured"
              })
            }),
            new DemoCandidate({
              predictorName: "qa",
              kind: "bootstrap-shuffled",
              params: new ModuleParameters({
                instructions: baselineParams.instructions,
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
          Match.value(String.includes("Always answer Paris")(prompt)).pipe(
            Match.when(true, () => ({ answer: "Paris" })),
            Match.orElse(() => ({ answer: "Tokyo" }))
          )
        )
      )
      const layer = Layer.succeed(LanguageModel.LanguageModel, mock.service)

      const result = yield* run({
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
      expect(
        Arr.some(Arr.fromIterable(result.optimizationResult.trials), (trial) => Equal.equals(trial.prior, true))
      ).toBe(true)
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
      const refs = yield* makeTrialRefs
      const seenConfigs = yield* Ref.make(Arr.empty<Phase3Config>())
      const scores = yield* Ref.make<Schema.Array$<typeof Schema.Number>["Type"]>(Arr.make(Num.unsafeDivide(0, 0), 1))

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

      expect(checkpointConfig).toEqual(baselineConfig)
      expect(Arr.length(seen)).toBe(2)
    }))

  it.effect("does not retain failed full-checkpoint candidates for later trials", () =>
    Effect.gen(function*() {
      const baselineConfig: Phase3Config = { qa__demo: 0, qa__instruction: 0 }
      const failedConfig: Phase3Config = { qa__demo: 0, qa__instruction: 1 }
      const validConfig: Phase3Config = { qa__demo: 0, qa__instruction: 2 }
      const refs = yield* makeTrialRefs
      yield* evaluateBaseline({
        baselineConfig,
        refs,
        valset: trainset,
        evaluateOn: () => Effect.succeed(Num.negate(5))
      })
      const failure = new AllTrialsFailed({ message: "full checkpoint failed", trialCount: 2 })
      const failed = yield* evaluateTrial({
        config: failedConfig,
        refs,
        minibatchExamples: Arr.take(trainset, 1),
        valset: trainset,
        fullEvalEvery: 1,
        emit: () => Effect.void,
        evaluateOn: (_config, examples) =>
          Effect.if(Num.Equivalence(Arr.length(examples), 1), {
            onTrue: () => Effect.succeed(Num.negate(1)),
            onFalse: () => Effect.fail(failure)
          })
      }).pipe(Effect.flip)
      expect(failed).toBe(failure)
      expect(yield* Ref.get(refs.bestScoreRef)).toEqual(Option.some(Num.negate(5)))
      expect(yield* Ref.get(refs.bestAveragingRef)).toEqual(Option.some(
        new BestAveragingCandidate({
          config: baselineConfig,
          score: Num.negate(5)
        })
      ))
      const fullConfigs = yield* Ref.make(Arr.empty<Phase3Config>())
      const score = yield* evaluateTrial({
        config: validConfig,
        refs,
        minibatchExamples: Arr.take(trainset, 1),
        valset: trainset,
        fullEvalEvery: 1,
        emit: () => Effect.void,
        evaluateOn: (config, examples) =>
          Effect.when(Ref.update(fullConfigs, Arr.append(config)), () => Num.Equivalence(Arr.length(examples), 2)).pipe(
            Effect.as(Num.negate(3))
          )
      })
      expect(score).toBe(Num.negate(3))
      expect(yield* Ref.get(refs.bestScoreRef)).toEqual(Option.some(Num.negate(3)))
      expect(yield* Ref.get(fullConfigs)).toEqual(Arr.make(validConfig))
      expect(yield* Ref.get(refs.fullEvalTrialsRef)).toEqual(Arr.make(1))
    }))

  it.effect("evicts a stored candidate that fails the next cadence-two checkpoint", () =>
    Effect.gen(function*() {
      const baselineConfig: Phase3Config = { qa__demo: 0, qa__instruction: 0 }
      const failedConfig: Phase3Config = { qa__demo: 0, qa__instruction: 1 }
      const validConfig: Phase3Config = { qa__demo: 0, qa__instruction: 2 }
      const lowerConfig: Phase3Config = { qa__demo: 0, qa__instruction: 3 }
      const refs = yield* makeTrialRefs
      const baseline = yield* evaluateBaseline({
        baselineConfig,
        refs,
        valset: trainset,
        evaluateOn: () => Effect.succeed(Num.negate(5))
      })
      yield* evaluateTrial({
        config: failedConfig,
        refs,
        minibatchExamples: Arr.take(trainset, 1),
        valset: trainset,
        fullEvalEvery: 2,
        emit: () => Effect.void,
        evaluateOn: () => Effect.succeed(Num.negate(1))
      })
      expect(yield* Ref.get(refs.bestAveragingRef)).toEqual(Option.some(
        new BestAveragingCandidate({ config: failedConfig, score: Num.negate(1) })
      ))
      const failure = new AllTrialsFailed({ message: "stored checkpoint failed", trialCount: 2 })
      const fullConfigs = yield* Ref.make(Arr.empty<Phase3Config>())
      const failed = yield* evaluateTrial({
        config: validConfig,
        refs,
        minibatchExamples: Arr.take(trainset, 1),
        valset: trainset,
        fullEvalEvery: 2,
        emit: () => Effect.void,
        evaluateOn: (config, examples) =>
          Effect.if(Num.Equivalence(Arr.length(examples), 1), {
            onTrue: () => Effect.succeed(Num.negate(3)),
            onFalse: () => Ref.update(fullConfigs, Arr.append(config)).pipe(Effect.zipRight(Effect.fail(failure)))
          })
      }).pipe(Effect.flip)
      const candidateAfterFailure = yield* Ref.get(refs.bestAveragingRef)
      const bestAfterFailure = yield* Ref.get(refs.bestScoreRef)

      yield* Effect.forEach(Arr.make(validConfig, lowerConfig), (config) =>
        evaluateTrial({
          config,
          refs,
          minibatchExamples: Arr.take(trainset, 1),
          valset: trainset,
          fullEvalEvery: 2,
          emit: () => Effect.void,
          evaluateOn: (evaluatedConfig, examples) =>
            Effect.if(Num.Equivalence(Arr.length(examples), 1), {
              onTrue: () =>
                Effect.succeed(
                  Match.value(Schema.equivalence(Phase3Config)(evaluatedConfig, validConfig)).pipe(
                    Match.when(true, () => Num.negate(3)),
                    Match.orElse(() => Num.negate(4))
                  )
                ),
              onFalse: () => Ref.update(fullConfigs, Arr.append(evaluatedConfig)).pipe(Effect.as(Num.negate(2)))
            })
        }))

      expect(yield* Ref.get(fullConfigs)).toEqual(Arr.make(failedConfig, validConfig))
      expect(failed).toBe(failure)
      expect(candidateAfterFailure).toEqual(Option.none())
      expect(bestAfterFailure).toEqual(Option.some(Num.negate(1)))
      expect(yield* Ref.get(refs.bestScoreRef)).toEqual(Option.some(Num.negate(1)))
      expect(yield* Ref.get(refs.bestAveragingRef)).toEqual(Option.some(
        new BestAveragingCandidate({ config: validConfig, score: Num.negate(3) })
      ))
      expect(yield* Ref.get(refs.fullEvalTrialsRef)).toEqual(Arr.make(3))
      expect(yield* Ref.get(refs.minibatchTrialsRef)).toEqual(Arr.make(0, 1, 2, 3))
      expect(Arr.head(baseline)).toEqual(Option.some(Num.negate(5)))
    }))
})
