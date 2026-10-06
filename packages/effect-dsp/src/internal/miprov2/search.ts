/** Runs MIPROv2's sequential Optuna-compatible trial scheduler. @internal */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler as SearchSampler, SearchSpace } from "@scenesystems/effect-search"
import { Array as Arr, BigDecimal, Chunk, Effect, Number as Num, Option, Record, Ref, Struct } from "effect"
import type { Schema } from "effect"
import { MIPROv2Error } from "../../DspError.js"
import * as Evaluate from "../../Evaluate.js"
import { projectSingleObjective } from "../../EvaluationObjective.js"
import { events, type Examples, TrialEvaluation } from "../../MIPROv2.js"
import { Diagnostics, noEvents, type Options, Result } from "../../MIPROv2Search.js"
import { bound } from "../../Module.js"
import * as ParameterSet from "../../ParameterSet.js"
import { bestFullEvaluation, nextFullEvaluation } from "./phase3State.js"
import { phase3TrialBudget, resolvePhase3Cadence } from "./runtime/budget.js"
import { parametersForConfig, ParametersForConfigOptions } from "./runtime/evaluate.js"
import type { Phase3Config } from "./runtime/model.js"
import {
  baselineConfig,
  buildSearchDimensions,
  maxCandidateCount,
  objectiveScore,
  resolveBindings,
  ResolveBindingsOptions
} from "./runtime/searchSpace.js"
import * as Sampling from "./sampling.js"

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
    const emit = options.emit ?? noEvents
    const bindings = yield* resolveBindings(new ResolveBindingsOptions(options))
    const dimensions = yield* buildSearchDimensions(bindings)
    const space = yield* SearchSpace.make(dimensions)
    const cadence = resolvePhase3Cadence(options)
    const minibatch = options.minibatch ?? true
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
      options.trialBudget ?? phase3TrialBudget({
        predictorCount: bindings.length,
        demoCandidateCount: Arr.isReadonlyArrayNonEmpty(options.demoCandidates)
          ? maxCandidateCount(
            bindings,
            (binding) => Option.match(binding.demos, { onNone: () => 0, onSome: (demos) => demos.candidates.length })
          )
          : 0,
        instructionCandidateCount: maxCandidateCount(bindings, (binding) => binding.instructions.candidates.length)
      })
    )
    const totalRows = 1 + trialBudget + (minibatch ? Numeric.ceil(trialBudget / cadence.fullEvalEvery) : 0)
    const rng = yield* Sampling.resolve(cadence.seed)
    const initialParameters = yield* ParameterSet.snapshot(options.module)
    const evaluations = yield* Ref.make(Arr.empty<TrialEvaluation>())
    const parameters = (config: Phase3Config) =>
      parametersForConfig(new ParametersForConfigOptions({ config, bindings, trialBudget }))
    const evaluateOn = (selected: ParameterSet.ParameterSet, examples: Examples) =>
      Evaluate.run(
        new Evaluate.Options({
          module: bound(options.module, { ...initialParameters, ...selected }),
          examples,
          metrics: { miprov2: options.metric },
          concurrency: options.numThreads ?? 1,
          maxErrors: options.maxErrors ?? Option.none()
        })
      ).pipe(
        Effect.flatMap((report) => projectSingleObjective(report, Option.some("miprov2"))),
        Effect.flatMap((projection) => objectiveScore(projection.objective)),
        Effect.map((score) =>
          Numeric.toBigDecimal(score * 100).pipe(
            Option.map(BigDecimal.round({ scale: 2, mode: "half-even" })),
            Option.map(BigDecimal.toNumberUnsafe),
            Option.getOrThrow
          )
        ),
        Effect.catch((error) => Effect.logError("MIPROv2 evaluation failed", error).pipe(Effect.as(0)))
      )
    const record = (evaluation: TrialEvaluation) =>
      Ref.update(evaluations, Arr.append(evaluation)).pipe(
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
    const baselineObjective = baselineScore / 100
    yield* study.tell(baselineTrial.trialNumber, baselineScore)
    yield* record(
      new TrialEvaluation({
        trial: baselineTrial.trialNumber,
        config: baseline,
        score: baselineObjective,
        fullValidation: true,
        sampled: false
      })
    )

    yield* Effect.forEach(trialBudget > 0 ? Arr.range(1, trialBudget) : [], (sampledNumber) =>
      Effect.gen(function*() {
        const trial = yield* study.ask
        const examples = minibatch && cadence.minibatchSize < options.valset.length
          ? Arr.fromIterable(yield* rng.sample(Chunk.fromIterable(options.valset), cadence.minibatchSize))
          : options.valset
        const score = yield* evaluateOn(yield* parameters(trial.config), examples)
        yield* record(
          new TrialEvaluation({
            trial: trial.trialNumber,
            config: trial.config,
            score: score / 100,
            fullValidation: !minibatch,
            sampled: true
          })
        )
        // Insert the full row while the objective is still pending, exactly as study.add_trial does.
        if (minibatch && (Num.remainder(sampledNumber, cadence.fullEvalEvery) === 0 || sampledNumber === trialBudget)) {
          const config = yield* nextFullEvaluation(yield* Ref.get(evaluations))
          yield* Ref.set(forced, Option.some(config))
          const full = yield* study.ask
          const fullScore = yield* evaluateOn(yield* parameters(config), options.valset)
          yield* study.tell(full.trialNumber, fullScore)
          yield* record(
            new TrialEvaluation({
              trial: full.trialNumber,
              config,
              score: fullScore / 100,
              fullValidation: true,
              sampled: false
            })
          )
          const best = yield* Effect.fromOption(bestFullEvaluation(yield* Ref.get(evaluations)))
          yield* emit(events.FullEvalCompleted({ bestScore: best.score }))
        }
        yield* study.tell(trial.trialNumber, score)
      }), { discard: true })

    const rows = yield* Ref.get(evaluations)
    const best = yield* Effect.fromOption(bestFullEvaluation(rows))
    const selected = best.trial === 0 ? initialParameters : { ...initialParameters, ...yield* parameters(best.config) }
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
