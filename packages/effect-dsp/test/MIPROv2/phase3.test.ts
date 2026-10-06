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
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Equal,
  Layer,
  Match,
  Number as Num,
  Option,
  Record as Rec,
  Ref,
  Schema,
  String,
  Tuple
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import { makeTrialRefs } from "../../src/internal/miprov2/phase3State.js"
import {
  evaluateBaseline,
  EvaluateBaselineOptions,
  evaluateTrial,
  EvaluateTrialOptions
} from "../../src/internal/miprov2/runtime/evaluate.js"
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
      const scores = yield* Ref.make<ReadonlyArray<number>>(Arr.make(NaN, 1))

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
              Effect.andThen(
                Ref.modify(scores, (remaining) => Tuple.make(Arr.head(remaining), Arr.drop(remaining, 1))).pipe(
                  Effect.flatMap(Effect.fromOption)
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
      yield* evaluateBaseline(
        new EvaluateBaselineOptions({
          baselineConfig,
          refs,
          valset: trainset,
          evaluateOn: () => Effect.succeed(Num.multiply(5, -1))
        })
      )
      const failure = new AllTrialsFailed({ message: "full checkpoint failed", trialCount: 2 })
      const failed = yield* evaluateTrial(
        new EvaluateTrialOptions({
          config: failedConfig,
          refs,
          minibatchExamples: Arr.take(trainset, 1),
          valset: trainset,
          fullEvalEvery: 1,
          emit: () => Effect.void,
          evaluateOn: (_config, examples) =>
            Bool.match(Num.Equivalence(Arr.length(examples), 1), {
              onTrue: () => Effect.succeed(Num.multiply(1, -1)),
              onFalse: () => Effect.fail(failure)
            })
        })
      ).pipe(Effect.flip)
      expect(failed).toBe(failure)
      expect(yield* Ref.get(refs.bestScoreRef)).toEqual(Option.some(Num.multiply(5, -1)))
      expect(yield* Ref.get(refs.bestAveragingRef)).toEqual(Option.some(
        new BestAveragingCandidate({
          config: baselineConfig,
          score: Num.multiply(5, -1)
        })
      ))
      const fullConfigs = yield* Ref.make(Arr.empty<Phase3Config>())
      const score = yield* evaluateTrial(
        new EvaluateTrialOptions({
          config: validConfig,
          refs,
          minibatchExamples: Arr.take(trainset, 1),
          valset: trainset,
          fullEvalEvery: 1,
          emit: () => Effect.void,
          evaluateOn: (config, examples) =>
            Bool.match(Num.Equivalence(Arr.length(examples), 2), {
              onFalse: () => Effect.void,
              onTrue: () => Ref.update(fullConfigs, Arr.append(config))
            }).pipe(Effect.as(Num.multiply(3, -1)))
        })
      )
      expect(score).toBe(Num.multiply(3, -1))
      expect(yield* Ref.get(refs.bestScoreRef)).toEqual(Option.some(Num.multiply(3, -1)))
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
      const baseline = yield* evaluateBaseline(
        new EvaluateBaselineOptions({
          baselineConfig,
          refs,
          valset: trainset,
          evaluateOn: () => Effect.succeed(Num.multiply(5, -1))
        })
      )
      yield* evaluateTrial(
        new EvaluateTrialOptions({
          config: failedConfig,
          refs,
          minibatchExamples: Arr.take(trainset, 1),
          valset: trainset,
          fullEvalEvery: 2,
          emit: () => Effect.void,
          evaluateOn: () => Effect.succeed(Num.multiply(1, -1))
        })
      )
      expect(yield* Ref.get(refs.bestAveragingRef)).toEqual(Option.some(
        new BestAveragingCandidate({ config: failedConfig, score: Num.multiply(1, -1) })
      ))
      const failure = new AllTrialsFailed({ message: "stored checkpoint failed", trialCount: 2 })
      const fullConfigs = yield* Ref.make(Arr.empty<Phase3Config>())
      const failed = yield* evaluateTrial(
        new EvaluateTrialOptions({
          config: validConfig,
          refs,
          minibatchExamples: Arr.take(trainset, 1),
          valset: trainset,
          fullEvalEvery: 2,
          emit: () => Effect.void,
          evaluateOn: (config, examples) =>
            Bool.match(Num.Equivalence(Arr.length(examples), 1), {
              onTrue: () => Effect.succeed(Num.multiply(3, -1)),
              onFalse: () => Ref.update(fullConfigs, Arr.append(config)).pipe(Effect.andThen(Effect.fail(failure)))
            })
        })
      ).pipe(Effect.flip)
      const candidateAfterFailure = yield* Ref.get(refs.bestAveragingRef)
      const bestAfterFailure = yield* Ref.get(refs.bestScoreRef)

      yield* Effect.forEach(Arr.make(validConfig, lowerConfig), (config) =>
        evaluateTrial(
          new EvaluateTrialOptions({
            config,
            refs,
            minibatchExamples: Arr.take(trainset, 1),
            valset: trainset,
            fullEvalEvery: 2,
            emit: () => Effect.void,
            evaluateOn: (evaluatedConfig, examples) =>
              Bool.match(Num.Equivalence(Arr.length(examples), 1), {
                onTrue: () =>
                  Effect.succeed(
                    Match.value(Schema.toEquivalence(Phase3Config)(evaluatedConfig, validConfig)).pipe(
                      Match.when(true, () => Num.multiply(3, -1)),
                      Match.orElse(() => Num.multiply(4, -1))
                    )
                  ),
                onFalse: () => Ref.update(fullConfigs, Arr.append(evaluatedConfig)).pipe(Effect.as(Num.multiply(2, -1)))
              })
          })
        ))

      expect(yield* Ref.get(fullConfigs)).toEqual(Arr.make(failedConfig, validConfig))
      expect(failed).toBe(failure)
      expect(candidateAfterFailure).toEqual(Option.none())
      expect(bestAfterFailure).toEqual(Option.some(Num.multiply(1, -1)))
      expect(yield* Ref.get(refs.bestScoreRef)).toEqual(Option.some(Num.multiply(1, -1)))
      expect(yield* Ref.get(refs.bestAveragingRef)).toEqual(Option.some(
        new BestAveragingCandidate({ config: validConfig, score: Num.multiply(3, -1) })
      ))
      expect(yield* Ref.get(refs.fullEvalTrialsRef)).toEqual(Arr.make(3))
      expect(yield* Ref.get(refs.minibatchTrialsRef)).toEqual(Arr.make(0, 1, 2, 3))
      expect(Arr.head(baseline)).toEqual(Option.some(Num.multiply(5, -1)))
    }))
})
