/** Runs MIPROv2's sequential Optuna-compatible trial scheduler. @internal */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler as SearchSampler, SearchSpace } from "@scenesystems/effect-search"
import {
  Array as Arr,
  BigDecimal,
  Boolean as Bool,
  Chunk,
  Effect,
  Match,
  Number as Num,
  Option,
  Record,
  Ref,
  Struct
} from "effect"
import type { Schema } from "effect"
import { MIPROv2Error } from "../../DspError.js"
import * as Evaluate from "../../Evaluate.js"
import { events, type Examples, TrialEvaluation } from "../../MIPROv2.js"
import { Diagnostics, noEvents, type Options, Result } from "../../MIPROv2Search.js"
import { bound } from "../../Module.js"
import * as ParameterSet from "../../ParameterSet.js"
import { bestFullEvaluation, nextFullEvaluation, ToldEvaluation } from "./phase3State.js"
import { phase3TrialBudget, resolvePhase3Cadence } from "./runtime/budget.js"
import { parametersForConfig, ParametersForConfigOptions } from "./runtime/evaluate.js"
import type { Phase3Config } from "./runtime/model.js"
import {
  baselineConfig,
  buildSearchDimensions,
  maxCandidateCount,
  resolveBindings,
  ResolveBindingsOptions
} from "./runtime/searchSpace.js"
import * as Sampling from "./sampling.js"

/** dspy.Evaluate's score, `round(100 * ncorrect / ntotal, 2)`: multiply, divide, then round the
 * exact binary quotient half-even to cents. `ncorrect` is CPython's builtin sum of per-example
 * metric values in input order; failed examples count as zero, DSPy's default failure_score.
 */
const evaluationPercentage = (report: Evaluate.Report, metricName: string): number =>
  Numeric.toBigDecimal(
    Num.divideUnsafe(
      Num.multiply(
        100,
        Numeric.sumNeumaier(Arr.map(report.outcomes, (outcome) =>
          Match.valueTags(outcome, {
            Failed: () => 0,
            Scored: (scored) => Option.getOrThrow(Record.get(scored.scores, metricName)).value
          })))
      ),
      Arr.length(report.outcomes)
    )
  ).pipe(
    Option.map(BigDecimal.round({ scale: 2, mode: "half-even" })),
    Option.map(BigDecimal.toNumberUnsafe),
    Option.getOrThrow
  )

/** Baseline and full checkpoints are actual study rows and consume no sampler draws. @internal */
export const runPhase3Search = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never,
  EE = never,
  ER = never
>(options: Options<I, O, ME, MR, E, R, EE, ER>) =>
  Effect.gen(function*() {
    const emit = Option.getOrElse(Option.fromUndefinedOr(options.emit), () => noEvents)
    const bindings = yield* resolveBindings(new ResolveBindingsOptions(options))
    const dimensions = yield* buildSearchDimensions(bindings)
    const space = yield* SearchSpace.make(dimensions)
    const cadence = resolvePhase3Cadence(options)
    const minibatch = Option.getOrElse(Option.fromUndefinedOr(options.minibatch), () => true)
    yield* Effect.fail(
      new MIPROv2Error({
        reason: "invalid-dataset",
        message: "Validation set must be nonempty and at least minibatchSize when minibatching."
      })
    ).pipe(
      Effect.when(
        Effect.succeed(options.valset.length === 0 || (minibatch && cadence.minibatchSize > options.valset.length))
      )
    )
    const trialBudget = Numeric.max(
      0,
      Option.getOrElse(Option.fromUndefinedOr(options.trialBudget), () =>
        phase3TrialBudget({
          predictorCount: bindings.length,
          demoCandidateCount: Bool.match(Arr.isReadonlyArrayNonEmpty(options.demoCandidates), {
            onFalse: () => 0,
            onTrue: () =>
              maxCandidateCount(
                bindings,
                (binding) =>
                  Option.match(binding.demos, { onNone: () => 0, onSome: (demos) => demos.candidates.length })
              )
          }),
          instructionCandidateCount: maxCandidateCount(bindings, (binding) => binding.instructions.candidates.length)
        }))
    )
    const totalRows = 1 + trialBudget +
      Bool.match(minibatch, { onFalse: () => 0, onTrue: () => Numeric.ceil(trialBudget / cadence.fullEvalEvery) })
    const rng = yield* Sampling.resolve(cadence.seed)
    const initialParameters = yield* ParameterSet.snapshot(options.module)
    // Told percentages stay beside each public row; checkpoint ranking never divides and reconstructs them.
    const ledger = yield* Ref.make(Arr.empty<ToldEvaluation>())
    const evaluations = Ref.get(ledger).pipe(Effect.map(Arr.map((row) => row.evaluation)))
    const parameters = (config: Phase3Config) =>
      parametersForConfig(new ParametersForConfigOptions({ config, bindings, trialBudget }))
    const evaluateOn = (selected: ParameterSet.ParameterSet, examples: Examples) =>
      Evaluate.run(
        new Evaluate.Options({
          module: bound(options.module, { ...initialParameters, ...selected }),
          examples,
          metrics: { miprov2: options.metric },
          concurrency: Option.getOrElse(Option.fromUndefinedOr(options.numThreads), () => 1),
          maxErrors: Option.getOrElse(Option.fromUndefinedOr(options.maxErrors), () => Option.none())
        })
      ).pipe(
        Effect.map((report) => evaluationPercentage(report, "miprov2")),
        Effect.catch((error) => Effect.logError("MIPROv2 evaluation failed", error).pipe(Effect.as(0)))
      )
    const record = (evaluation: TrialEvaluation, percent: number) =>
      Ref.update(ledger, Arr.append(new ToldEvaluation({ evaluation, percent }))).pipe(
        Effect.andThen(emit(events.TrialEvaluated(evaluation)))
      )
    const baseline = baselineConfig(bindings)
    const forced = yield* Ref.make<Option.Option<Phase3Config>>(Option.some(baseline))
    const tpe = SearchSampler.tpe(new SearchSampler.TpeOptions({ seed: cadence.seed, multivariate: true }))
    const sampler = new SearchSampler.Sampler(Struct.assign(tpe, {
      suggest: (searchSpace: SearchSpace.SearchSpace, context: SearchSampler.Context) =>
        Ref.getAndSet(forced, Option.none()).pipe(
          Effect.flatMap(Option.match({ onNone: () => tpe.suggest(searchSpace, context), onSome: Effect.succeed }))
        )
    }))
    const study = yield* Optimization.open(
      new Optimization.FlatOptions({
        space,
        sampler,
        trials: totalRows,
        direction: "maximize",
        objective: () => Effect.succeed(0)
      })
    )
    const baselineTrial = yield* study.ask
    const baselineScore = yield* evaluateOn(initialParameters, options.valset)
    const baselineObjective = Num.divideUnsafe(baselineScore, 100)
    yield* study.tell(baselineTrial.trialNumber, baselineScore)
    yield* record(
      new TrialEvaluation({
        trial: baselineTrial.trialNumber,
        config: baseline,
        score: baselineObjective,
        fullValidation: true,
        sampled: false
      }),
      baselineScore
    )

    yield* Effect.forEach(
      Bool.match(trialBudget > 0, { onFalse: () => Arr.empty<number>(), onTrue: () => Arr.range(1, trialBudget) }),
      (sampledNumber) =>
        Effect.gen(function*() {
          const trial = yield* study.ask
          const examples = yield* Bool.match(minibatch && cadence.minibatchSize < options.valset.length, {
            onFalse: () => Effect.succeed(options.valset),
            onTrue: () =>
              rng.sample(Chunk.fromIterable(options.valset), cadence.minibatchSize).pipe(Effect.map(Arr.fromIterable))
          })
          const score = yield* evaluateOn(yield* parameters(trial.config), examples)
          yield* record(
            new TrialEvaluation({
              trial: trial.trialNumber,
              config: trial.config,
              score: Num.divideUnsafe(score, 100),
              fullValidation: !minibatch,
              sampled: true
            }),
            score
          )
          // Insert the full row while the objective is still pending, exactly as study.add_trial does.
          yield* Effect.gen(function*() {
            const config = yield* nextFullEvaluation(yield* Ref.get(ledger))
            yield* Ref.set(forced, Option.some(config))
            const full = yield* study.ask
            const fullScore = yield* evaluateOn(yield* parameters(config), options.valset)
            yield* study.tell(full.trialNumber, fullScore)
            yield* record(
              new TrialEvaluation({
                trial: full.trialNumber,
                config,
                score: Num.divideUnsafe(fullScore, 100),
                fullValidation: true,
                sampled: false
              }),
              fullScore
            )
            const best = yield* Effect.fromOption(bestFullEvaluation(yield* evaluations))
            yield* emit(events.FullEvalCompleted({ bestScore: best.score }))
          }).pipe(
            Effect.when(
              Effect.succeed(
                minibatch &&
                  (Num.remainder(sampledNumber, cadence.fullEvalEvery) === 0 || sampledNumber === trialBudget)
              )
            )
          )
          yield* study.tell(trial.trialNumber, score)
        }),
      { discard: true }
    )

    const rows = yield* evaluations
    const best = yield* Effect.fromOption(bestFullEvaluation(rows))
    const selected = yield* Bool.match(best.trial === 0, {
      onFalse: () =>
        parameters(best.config).pipe(Effect.map((configured) => ({ ...initialParameters, ...configured }))),
      onTrue: () => Effect.succeed(initialParameters)
    })
    return new Result<I, O, E, R>({
      program: bound(options.module, selected),
      parameters: selected,
      optimizationResult: yield* study.result,
      diagnostics: new Diagnostics({
        dimensionNames: Record.keys(dimensions),
        samplerKind: "tpe",
        multivariate: true,
        trialBudget,
        minibatchSize: cadence.minibatchSize,
        fullEvalEvery: cadence.fullEvalEvery,
        fullEvalTrialNumbers: Arr.map(Arr.filter(rows, (row) => row.fullValidation), (row) => row.trial),
        minibatchTrialNumbers: Arr.map(Arr.filter(rows, (row) => !row.fullValidation), (row) => row.trial),
        priorTrialCount: 1,
        baselineObjective,
        bestScore: best.score,
        bestTrial: best.trial,
        evaluations: rows
      })
    })
  }).pipe(Effect.scoped)
