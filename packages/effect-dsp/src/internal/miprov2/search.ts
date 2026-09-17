/**
 * Runs Phase 3 TPE search across instruction and demonstration indexes.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al., "Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", 2024}
 * @since 0.1.0
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Optimization, Sampler as SearchSampler, SearchSpace } from "@scenesystems/effect-search"
import { Array as Arr, Effect, Number as Num, Option, Ref } from "effect"
import type { Schema } from "effect"
import { AllTrialsFailed } from "../../DspError.js"
import * as Evaluate from "../../Evaluate.js"
import { projectSingleObjective } from "../../EvaluationObjective.js"
import type { Examples } from "../../MIPROv2.js"
import { Diagnostics, noEvents, type Options, Result } from "../../MIPROv2Search.js"
import { makeTrialRefs } from "./phase3State.js"
import {
  normalizePositive,
  phase3TrialBudget as phase3TrialBudgetFormula,
  resolvePhase3Cadence
} from "./runtime/budget.js"
import {
  applyPhase3Config,
  ApplyPhase3ConfigOptions,
  evaluateBaseline,
  EvaluateBaselineOptions,
  evaluateTrial,
  EvaluateTrialOptions
} from "./runtime/evaluate.js"
import { demoDimensionName, instructionDimensionName, type Phase3Config } from "./runtime/model.js"
import {
  baselineConfig,
  buildSearchDimensions,
  maxCandidateCount,
  objectiveScore,
  resolveBestConfig,
  resolveBindings,
  ResolveBindingsOptions
} from "./runtime/searchSpace.js"

/**
 * Evaluates candidate indexes with a single-concurrency, multivariate TPE study.
 *
 * @remarks
 * Every predictor contributes one demonstration dimension and one instruction
 * dimension. Each dimension accepts at most ten candidates. The index-zero
 * configuration is evaluated on the full validation set and supplied to the
 * study as a prior trial. New trial objectives use the same leading validation
 * prefix; the prefix is not reshuffled between trials.
 *
 * Full-set checkpoints evaluate the best minibatch candidate seen so far and
 * update `diagnostics.bestScore`. They do not replace the objective reported to
 * TPE. The study's best trial is applied to the supplied module after search.
 * Parameter writes are sequential and are not rolled back after failure or
 * interruption.
 *
 * Missing candidate sets, unsupported dimension sizes, malformed sampled
 * indexes, and an empty winning result fail with `AllTrialsFailed`. Failures
 * of every example in an evaluation also fail with `AllTrialsFailed`, before
 * report projection; reports with some successful examples remain scoreable.
 * A failed baseline aborts search, and failed study trials cannot beat the
 * successful baseline prior, including when all new trials fail. Failures
 * raised inside the effect-search study retain the study's `SearchError`
 * channel. Baseline evaluation also retains its metric, module, Schema, and
 * language-model error channels.
 *
 * @param options - Module, validation set, candidate sets, metric, and search settings.
 * @returns The supplied module, raw study result, and a diagnostic snapshot.
 * @typeParam I - Input fields accepted by the evaluated module.
 * @typeParam O - Output fields scored by the configured metric.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @see {@link https://arxiv.org/abs/2406.11695 | Opsahl-Ong et al. (2024)}
 * @since 0.1.0
 * @category constructors
 */
export const runPhase3Search = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never,
  EE = never,
  ER = never
>(
  options: Options<I, O, ME, MR, E, R, EE, ER>
) =>
  Effect.gen(function*() {
    const evaluationContext = yield* Effect.context<
      | LanguageModel.LanguageModel
      | MR
      | R
      | ER
      | Schema.Schema.Context<Schema.Struct<I>>
      | Schema.Schema.Context<Schema.Struct<O>>
    >()
    const emit = Option.getOrElse(Option.fromNullable(options.emit), () => noEvents)
    const bindings = yield* resolveBindings(
      new ResolveBindingsOptions({
        module: options.module,
        demoCandidates: options.demoCandidates,
        instructionCandidates: options.instructionCandidates
      })
    )
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
    const demoCandidateCount = maxCandidateCount(bindings, (binding) => Arr.length(binding.demos.candidates))
    const instructionCandidateCount = maxCandidateCount(bindings, (binding) =>
      Arr.length(binding.instructions.candidates))
    const trialBudget = normalizePositive(
      Option.getOrElse(
        Option.fromNullable(options.trialBudget),
        () =>
          phase3TrialBudgetFormula({
            predictorCount: Arr.length(bindings),
            demoCandidateCount,
            instructionCandidateCount
          })
      ),
      1
    )
    const minibatchExamples = Arr.take(options.valset, cadence.minibatchSize)
    const refs = yield* makeTrialRefs
    const evaluateOn = (config: Phase3Config, examples: Examples) =>
      Effect.gen(function*() {
        yield* applyPhase3Config(
          new ApplyPhase3ConfigOptions({
            config,
            bindings,
            trialBudget
          })
        )

        const report = yield* Evaluate.run({
          module: options.module,
          examples,
          metrics: {
            miprov2: options.metric
          },
          concurrency: 1
        }).pipe(Effect.provide(evaluationContext))
        yield* Effect.when(
          Effect.fail(
            new AllTrialsFailed({
              message: "MIPROv2 Phase 3 evaluation produced zero successful examples",
              trialCount: Arr.length(examples)
            })
          ),
          () =>
            Num.lessThanOrEqualTo(report.successCount, 0)
        )
        const projection = yield* projectSingleObjective(report, Option.some("miprov2"))

        return yield* objectiveScore(projection.objective)
      })
    const baseline = baselineConfig(bindings)
    const [baselineObjective, priorTrial] = yield* evaluateBaseline(
      new EvaluateBaselineOptions({
        baselineConfig: baseline,
        valset: options.valset,
        refs,
        evaluateOn
      })
    )

    const studyResult = yield* Optimization.maximize({
      space,
      sampler: SearchSampler.tpe({ seed: cadence.seed, multivariate: true }),
      trials: trialBudget,
      objective: (config) =>
        evaluateTrial(
          new EvaluateTrialOptions({
            config,
            refs,
            minibatchExamples,
            valset: options.valset,
            fullEvalEvery: cadence.fullEvalEvery,
            emit,
            evaluateOn
          })
        ).pipe(Effect.provide(evaluationContext)),
      priorTrials: Arr.make(priorTrial),
      concurrency: 1
    })

    const bestConfig = yield* resolveBestConfig(studyResult, trialBudget)

    yield* applyPhase3Config(
      new ApplyPhase3ConfigOptions({
        config: bestConfig,
        bindings,
        trialBudget
      })
    )

    const fullEvalTrialNumbers = yield* Ref.get(refs.fullEvalTrialsRef)
    const minibatchTrialNumbers = yield* Ref.get(refs.minibatchTrialsRef)
    const bestScore = Option.getOrElse(yield* Ref.get(refs.bestScoreRef), () => baselineObjective)

    return new Result<I, O, E, R>({
      module: options.module,
      studyResult,
      diagnostics: new Diagnostics({
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
        baselineObjective,
        bestScore
      })
    })
  })
