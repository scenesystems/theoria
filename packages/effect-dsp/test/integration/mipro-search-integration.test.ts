/**
 * MIPROv2 + effect-search integration contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Option, Record, Ref, Schema } from "effect"
import { ModuleParams, ObjectiveProjection } from "effect-dsp/contracts"
import * as Evaluate from "effect-dsp/Evaluate"
import { Example } from "effect-dsp/Example"
import * as Metric from "effect-dsp/Metric"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import { DemoCandidate, PredictorDemoCandidates } from "../../src/optimizers/MIPROv2/bootstrap.js"
import { InstructionCandidate, PredictorInstructionCandidates } from "../../src/optimizers/MIPROv2/propose.js"
import { runPhase3Search } from "../../src/optimizers/MIPROv2/search.js"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

const dataset = Arr.make(
  new Example({
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris" }
  }),
  new Example({
    input: { question: "What is the capital of Japan?" },
    output: { answer: "Tokyo" }
  })
)

describe("MIPROv2/effect-search integration", () => {
  it.effect("projects objective values through ObjectiveProjection during effect-search trials", () =>
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
              instruction: "Use concise facts for capitals",
              tip: "focus",
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

      const report = yield* Evaluate.run({
        module,
        examples: dataset,
        metrics: {
          mipro: Metric.exactMatch("answer")
        },
        concurrency: 1
      }).pipe(Effect.provide(layer))
      const projected = yield* ObjectiveProjection.fromReport({ report, mode: "single", metricName: "mipro" })

      const result = yield* runPhase3Search({
        module,
        valset: dataset,
        metric: Metric.exactMatch("answer"),
        demoCandidates,
        instructionCandidates,
        trialBudget: 4,
        minibatchSize: 1,
        fullEvalEvery: 2,
        seed: 73
      }).pipe(Effect.provide(layer))
      const defaultCadence = yield* runPhase3Search({
        module,
        valset: dataset,
        metric: Metric.exactMatch("answer"),
        demoCandidates,
        instructionCandidates,
        trialBudget: 3,
        seed: 73
      }).pipe(Effect.provide(layer))

      expect(result.studyResult._tag).toBe("SingleObjective")
      expect(result.studyResult.trials.length).toBeGreaterThan(0)
      expect(
        Option.isSome(
          Arr.findFirst(
            result.studyResult.trials,
            (trial) =>
              Schema.is(Schema.Record({ key: Schema.String, value: Schema.Unknown }))(trial.config) &&
              Record.has(trial.config, "qa__demo") &&
              Record.has(trial.config, "qa__instruction")
          )
        )
      ).toBe(true)
      expect(result.diagnostics.baselineObjective).toBe(projected.objective)
      expect(result.diagnostics.priorTrialCount).toBe(1)
      expect(result.diagnostics.fullEvalTrialNumbers).toEqual(Arr.make(1, 3))
      expect(result.diagnostics.minibatchTrialNumbers).toEqual(Arr.make(0, 1, 2, 3))
      expect(defaultCadence.diagnostics.minibatchSize).toBe(50)
      expect(defaultCadence.diagnostics.fullEvalEvery).toBe(5)
    }))
})
