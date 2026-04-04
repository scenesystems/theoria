/**
 * MIPROv2 Phase 3 — Bayesian search over the instruction×demo space via
 * effect-search.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Option, Ref } from "effect"
import type { Schema } from "effect"
import { Sampler as SearchSampler, SearchSpace, Study } from "effect-search"
import { projectSingleObjective } from "../../contracts/ObjectiveProjection.js"
import { AllTrialsFailed } from "../../Errors/optimizer.js"
import * as Evaluate from "../../Evaluate/index.js"
import type { Example } from "../../Example/index.js"
import { noPhase3Events, Phase3Diagnostics, type RunPhase3SearchOptions } from "./phase3-model.js"
import { phase3TrialBudget as phase3TrialBudgetFormula, resolvePhase3Cadence } from "./runtime/budget.js"
import { applyPhase3Config, evaluateBaseline, evaluateTrial, makePhase3TrialRefs } from "./runtime/evaluate.js"
import { demoDimensionName, instructionDimensionName, type Phase3Config } from "./runtime/model.js"
import {
  baselineConfig,
  buildSearchDimensions,
  maxCandidateCount,
  objectiveScore,
  resolveBestConfig,
  resolveBindings
} from "./runtime/search-space.js"

export { noPhase3Events, Phase3Diagnostics } from "./phase3-model.js"
export type { Phase3EventSink, Phase3SearchResult, RunPhase3SearchOptions } from "./phase3-model.js"

/**
 * Deterministic trial-budget formula for Phase 3.
 *
 * @since 0.1.0
 * @category constructors
 */
export const phase3TrialBudget = phase3TrialBudgetFormula

/**
 * Run Phase 3 Bayesian instruction×demo co-optimization strictly through
 * effect-search seams.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
 * @since 0.1.0
 * @category constructors
 */
export const runPhase3Search = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: RunPhase3SearchOptions<I, O, ME, MR>
) =>
  Effect.gen(function*() {
    const evaluationContext = yield* Effect.context<
      | LanguageModel.LanguageModel
      | MR
      | Schema.Schema.Context<Schema.Struct<I>>
      | Schema.Schema.Context<Schema.Struct<O>>
    >()
    const emit = Option.getOrElse(Option.fromNullable(options.emit), () => noPhase3Events)
    const bindings = yield* resolveBindings({
      module: options.module,
      demoCandidates: options.demoCandidates,
      instructionCandidates: options.instructionCandidates
    })
    const dimensions = yield* buildSearchDimensions(bindings)
    const space = yield* SearchSpace.make(dimensions)
    const cadence = resolvePhase3Cadence({
      ...Option.match(Option.fromNullable(options.seed), {
        onNone: () => ({}),
        onSome: (seed) => ({ seed })
      }),
      ...Option.match(Option.fromNullable(options.minibatchSize), {
        onNone: () => ({}),
        onSome: (minibatchSize) => ({ minibatchSize })
      }),
      ...Option.match(Option.fromNullable(options.fullEvalEvery), {
        onNone: () => ({}),
        onSome: (fullEvalEvery) => ({ fullEvalEvery })
      })
    })
    const demoCandidateCount = maxCandidateCount(bindings, (binding) => binding.demos.candidates.length)
    const instructionCandidateCount = maxCandidateCount(bindings, (binding) => binding.instructions.candidates.length)
    const trialBudget = Option.getOrElse(
      Option.fromNullable(options.trialBudget),
      () =>
        phase3TrialBudget({
          predictorCount: bindings.length,
          demoCandidateCount,
          instructionCandidateCount
        })
    )
    const minibatchExamples = Arr.take(options.valset, cadence.minibatchSize)
    const refs = yield* makePhase3TrialRefs
    const evaluateOn = (config: Phase3Config, examples: ReadonlyArray<Example>) =>
      Effect.gen(function*() {
        yield* applyPhase3Config({
          config,
          bindings,
          trialBudget
        })

        const report = yield* Evaluate.run({
          module: options.module,
          examples,
          metrics: {
            miprov2: options.metric
          },
          concurrency: 1
        }).pipe(Effect.provide(evaluationContext))
        const projection = yield* projectSingleObjective(report, "miprov2")

        return yield* objectiveScore(projection.objective)
      })
    const baseline = baselineConfig(bindings)
    const baselineResult = yield* evaluateBaseline({
      baselineConfig: baseline,
      valset: options.valset,
      refs,
      evaluateOn
    })

    const studyResult = yield* Study.maximize({
      space,
      sampler: SearchSampler.tpe({ seed: cadence.seed, multivariate: true }),
      trials: trialBudget,
      objective: (config) =>
        evaluateTrial({
          config,
          refs,
          minibatchExamples,
          valset: options.valset,
          fullEvalEvery: cadence.fullEvalEvery,
          emit,
          evaluateOn
        }),
      priorTrials: Arr.make(baselineResult.priorTrial),
      concurrency: 1
    }).pipe(
      Effect.mapError(
        () =>
          new AllTrialsFailed({
            message: "MIPROv2 Phase 3 failed to complete effect-search study",
            trialCount: trialBudget
          })
      )
    )

    const bestConfig = yield* resolveBestConfig(studyResult, trialBudget)

    yield* applyPhase3Config({
      config: bestConfig,
      bindings,
      trialBudget
    })

    const fullEvalTrialNumbers = yield* Ref.get(refs.fullEvalTrialsRef)
    const minibatchTrialNumbers = yield* Ref.get(refs.minibatchTrialsRef)
    const bestScore = yield* Ref.get(refs.bestScoreRef)

    return {
      module: options.module,
      studyResult,
      diagnostics: new Phase3Diagnostics({
        dimensionNames: Arr.flatMap(
          bindings,
          (binding) =>
            Arr.make(demoDimensionName(binding.predictorName), instructionDimensionName(binding.predictorName))
        ),
        samplerKind: "tpe",
        multivariate: true,
        trialBudget,
        minibatchSize: cadence.minibatchSize,
        fullEvalEvery: cadence.fullEvalEvery,
        fullEvalTrialNumbers,
        minibatchTrialNumbers,
        priorTrialCount: 1,
        baselineObjective: baselineResult.baselineObjective,
        bestScore
      })
    }
  })
