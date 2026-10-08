/**
 * Searches independent zero-shot, labeled, and bootstrapped programs.
 * @since 0.1.0
 * @module
 */
import type { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Boolean as Bool, Chunk, Data, Effect, Number as Num, Option, Ref, Schema } from "effect"
import * as BootstrapFewShot from "./BootstrapFewShot.js"
import * as Evaluate from "./Evaluate.js"
import type { Example } from "./Example.js"
import { effectiveMaxErrors } from "./internal/maxErrors.js"
import * as LabeledFewShot from "./LabeledFewShot.js"
import type { Metric } from "./Metric.js"
import * as Module from "./Module.js"
import * as Optimized from "./Optimized.js"
import * as ParameterSet from "./ParameterSet.js"
import { IncompatibleTeacher } from "./TeacherTrace.js"

const Candidate = Schema.Struct({
  seed: Schema.Int,
  score: Schema.Finite,
  parameters: ParameterSet.ParameterSet,
  evaluation: Evaluate.Report
})

/** Complete evaluated candidate history in construction order; ties keep the earliest seed.
 * @since 0.7.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/BootstrapRS/Report")({
  candidates: Schema.Array(Candidate),
  winnerSeed: Schema.Int
}) {}

/** Configures independent bootstrap candidates and full-validation comparison.
 * @since 0.1.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  /** Program compiled through immutable parameter overlays. */
  readonly module: Module.Module<I, O, E, R>
  /** Training rows shuffled independently for each nonnegative candidate seed. */
  readonly trainset: ReadonlyArray<Example>
  /** Full validation set; defaults to the training set. */
  readonly valset?: ReadonlyArray<Example>
  /** Bootstrap acceptance and validation metric. */
  readonly metric: Metric<ME, MR>
  /** Random candidate count, default 16, in addition to seeds -3, -2, and -1. */
  readonly numCandidatePrograms?: number
  /** Round cap per bootstrap candidate, default 1. */
  readonly maxRounds?: number
  /** Upper bound on uniformly sampled trace-demo caps, default 4 (minimum 1). */
  readonly maxBootstrappedDemos?: number
  /** Labeled demonstration cap, default 16. */
  readonly maxLabeledDemos?: number
  /** Optional bootstrap acceptance threshold. */
  readonly metricThreshold?: Option.Option<number>
  /** Error count that aborts each bootstrap or validation pass; absent or none uses DSPy's settings default, 10. */
  readonly maxErrors?: Option.Option<number>
  /** Stop after a full validation average reaches this fraction in [0, 1].
   * DSPy's stop_at_score is compared with a percentage rounded to two decimals; this compares the
   * unrounded fraction, so averages within 0.00005 below the threshold continue where DSPy stops.
   */
  readonly stopAtScore?: Option.Option<number>
  /** Teacher program used by each BootstrapFewShot compilation. */
  readonly teacher?: Module.Module<I, O, E, R>
  /** Settings bound only to teacher executions. */
  readonly teacherSettings?: ModelSettings
}> {}

const count = (value: number) =>
  Bool.match(Numeric.isFinite(value), {
    onTrue: () => Numeric.max(0, Numeric.floor(value)),
    onFalse: () => 0
  })

/**
 * Compiles and evaluates one candidate at a time, preserving every evaluated result.
 *
 * Seeds -3, -2, and -1 are zero-shot, labeled-only, and unshuffled bootstrap.
 * Nonnegative seeds shuffle training rows and uniformly sample a cap in [1, max].
 * Shuffle and cap use separate CPython-compatible streams initialized with the same seed.
 * Every candidate starts independently from the supplied program. Evaluate.average
 * includes failed rows in its denominator. The highest fraction score wins, with
 * earliest-candidate ties. stopAtScore prevents construction of subsequent candidates.
 *
 * DSPy ranks `round(100 * ncorrect / ntotal, 2)` percentages. Ranking the unrounded
 * fraction differs only when two averages round to the same hundredth of a percent,
 * so they differ by less than 0.0001: DSPy keeps the earlier candidate, this keeps the
 * higher fraction. Fractions 0.0001 or more apart rank identically.
 *
 * Checked bootstrap and evaluation errors consume maxErrors; exhausted budgets propagate.
 * An absent maxErrors is DSPy's `dspy.settings.max_errors`, 10, for every bootstrap
 * compilation and validation pass.
 * Caller parameters remain unchanged on success, failure, and interruption.
 *
 * @since 0.1.0
 * @category constructors
 */
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(options: Options<I, O, ME, MR, E, R>) =>
  Effect.gen(function*() {
    yield* Effect.failSync(() =>
      new IncompatibleTeacher({
        message: "Teacher and student must be distinct executable programs"
      })
    ).pipe(Effect.when(Effect.succeed(options.teacher === options.module)))
    yield* Effect.forEach(
      Option.toArray(Option.flatten(Option.fromUndefinedOr(options.stopAtScore))),
      (threshold) => Schema.decodeEffect(Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })))(threshold)
    )
    const original = Module.bound(options.module, yield* ParameterSet.snapshot(options.module))
    // One effective budget for every bootstrap compilation and validation pass, as compile does.
    const maxErrors = effectiveMaxErrors(Option.flatten(Option.fromUndefinedOr(options.maxErrors)))
    const maxBootstrappedDemos = Numeric.max(
      1,
      count(Option.getOrElse(Option.fromUndefinedOr(options.maxBootstrappedDemos), () => 4))
    )
    const maxLabeledDemos = count(Option.getOrElse(Option.fromUndefinedOr(options.maxLabeledDemos), () => 16))
    const candidates = yield* Ref.make(Arr.empty<typeof Candidate.Type>())
    const best = yield* Ref.make(Option.none<typeof Candidate.Type>())
    yield* Effect.forEach(
      Arr.makeBy(
        Num.sum(count(Option.getOrElse(Option.fromUndefinedOr(options.numCandidatePrograms), () => 16)), 3),
        (index) => Num.subtract(index, 3)
      ),
      (seed) =>
        Effect.gen(function*() {
          const program = yield* Bool.match(seed === -3 || seed === -2, {
            onTrue: () =>
              LabeledFewShot.run(
                new LabeledFewShot.Options({
                  module: original,
                  trainset: options.trainset,
                  k: Bool.match(seed === -3, { onTrue: () => 0, onFalse: () => maxLabeledDemos }),
                  seed: 0
                })
              ).pipe(Effect.map((result) => result.program)),
            onFalse: () =>
              Effect.gen(function*() {
                const trainset = yield* Bool.match(seed < 0, {
                  onTrue: () => Effect.succeed(options.trainset),
                  onFalse: () =>
                    PseudoRandom.makeCPython(seed).pipe(Effect.flatMap((sampling) =>
                      sampling.shuffle(Chunk.fromIterable(options.trainset)).pipe(Effect.map(Arr.fromIterable))
                    ))
                })
                const cap = yield* Bool.match(seed < 0, {
                  onTrue: () =>
                    Effect.succeed(maxBootstrappedDemos),
                  onFalse: () =>
                    PseudoRandom.makeCPython(seed).pipe(Effect.flatMap((sampling) =>
                      sampling.randint(1, maxBootstrappedDemos)
                    ))
                })
                return (yield* BootstrapFewShot.run(
                  new BootstrapFewShot.Options({
                    module: original,
                    trainset,
                    metric: options.metric,
                    maxRounds: Option.getOrElse(Option.fromUndefinedOr(options.maxRounds), () => 1),
                    maxBootstrappedDemos: cap,
                    maxLabeledDemos,
                    metricThreshold: Option.flatten(Option.fromUndefinedOr(options.metricThreshold)),
                    maxErrors,
                    ...Option.match(Option.fromUndefinedOr(options.teacher), {
                      onNone: () => ({}),
                      onSome: (teacher) => ({ teacher })
                    }),
                    ...Option.match(Option.fromUndefinedOr(options.teacherSettings), {
                      onNone: () => ({}),
                      onSome: (teacherSettings) => ({ teacherSettings })
                    })
                  })
                )).program
              })
          })
          const evaluation = yield* Evaluate.run(
            new Evaluate.Options({
              module: program,
              examples: Option.getOrElse(Option.fromUndefinedOr(options.valset), () => options.trainset),
              metrics: { bootstrapRS: options.metric },
              concurrency: 1,
              maxErrors
            })
          )
          const candidate = {
            seed,
            score: evaluation.average,
            parameters: yield* ParameterSet.snapshot(program),
            evaluation
          }
          yield* Ref.update(candidates, Arr.append(candidate))
          yield* Ref.update(best, (previous) =>
            Option.match(previous, {
              onNone: () => Option.some(candidate),
              onSome: (current) =>
                Bool.match(candidate.score > current.score, {
                  onTrue: () => Option.some(candidate),
                  onFalse: () => previous
                })
            }))
        }).pipe(Effect.when(
          Ref.get(best).pipe(Effect.map((previous) =>
            !Option.exists(previous, (candidate) =>
              Option.exists(
                Option.flatten(Option.fromUndefinedOr(options.stopAtScore)),
                (threshold) => candidate.score >= threshold
              ))
          ))
        ))
    )
    const winner = Option.getOrThrow(yield* Ref.get(best))
    return new Optimized.Result({
      program: Module.bound(options.module, winner.parameters),
      parameters: winner.parameters,
      report: new Report({ candidates: yield* Ref.get(candidates), winnerSeed: winner.seed })
    })
  })
