/**
 * Searches independent zero-shot, labeled, and bootstrapped programs.
 * @since 0.1.0
 * @module
 */
import type { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Array as Arr, Chunk, Data, Effect, Option, Ref, Schema } from "effect"
import * as BootstrapFewShot from "./BootstrapFewShot.js"
import * as Evaluate from "./Evaluate.js"
import type { Example } from "./Example.js"
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
 * @since 0.6.0
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
  /** Error count that aborts each bootstrap or validation pass. */
  readonly maxErrors?: Option.Option<number>
  /** Stop after a full validation average reaches this fraction in [0, 1].
   * DSPy's stop_at_score is a percentage; this is the equivalent fraction.
   */
  readonly stopAtScore?: Option.Option<number>
  /** Teacher program used by each BootstrapFewShot compilation. */
  readonly teacher?: Module.Module<I, O, E, R>
  /** Settings bound only to teacher executions. */
  readonly teacherSettings?: ModelSettings
}> {}

const count = (value: number) => Numeric.isFinite(value) ? Numeric.max(0, Numeric.floor(value)) : 0

/**
 * Compiles and evaluates one candidate at a time, preserving every evaluated result.
 *
 * Seeds -3, -2, and -1 are zero-shot, labeled-only, and unshuffled bootstrap.
 * Nonnegative seeds shuffle training rows and uniformly sample a cap in [1, max].
 * Shuffle and cap use separate CPython-compatible streams initialized with the same seed.
 * Every candidate starts independently from the supplied program. Evaluate.average
 * includes failed rows in its denominator. The highest fraction score wins, with
 * earliest-candidate ties. stopAtScore prevents construction of subsequent candidates.
 * Checked evaluation errors consume maxErrors; exhausted budgets propagate.
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
    if (options.teacher === options.module) {
      return yield* new IncompatibleTeacher({ message: "Teacher and student must be distinct executable programs" })
    }
    yield* Effect.forEach(
      Option.toArray(options.stopAtScore ?? Option.none()),
      (threshold) => Schema.decodeEffect(Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })))(threshold)
    )
    const original = Module.bound(options.module, yield* ParameterSet.snapshot(options.module))
    const maxBootstrappedDemos = Numeric.max(1, count(options.maxBootstrappedDemos ?? 4))
    const maxLabeledDemos = count(options.maxLabeledDemos ?? 16)
    const candidates = yield* Ref.make(Arr.empty<typeof Candidate.Type>())
    const best = yield* Ref.make(Option.none<typeof Candidate.Type>())
    yield* Effect.forEach(Arr.makeBy(count(options.numCandidatePrograms ?? 16) + 3, (index) => index - 3), (seed) =>
      Effect.gen(function*() {
        if (
          Option.exists(yield* Ref.get(best), (candidate) =>
            Option.exists(options.stopAtScore ?? Option.none(), (threshold) =>
              candidate.score >= threshold))
        ) {
          return
        }
        const program = yield* Effect.gen(function*() {
          if (seed === -3 || seed === -2) {
            return (yield* LabeledFewShot.run(
              new LabeledFewShot.Options({
                module: original,
                trainset: options.trainset,
                k: seed === -3 ? 0 : maxLabeledDemos,
                seed: 0
              })
            )).program
          }
          const trainset = seed < 0
            ? options.trainset
            : yield* PseudoRandom.makeCPython(seed).pipe(Effect.flatMap((sampling) =>
              sampling.shuffle(Chunk.fromIterable(options.trainset)).pipe(Effect.map(Arr.fromIterable))
            ))
          const cap = seed < 0
            ? maxBootstrappedDemos
            : yield* PseudoRandom.makeCPython(seed).pipe(Effect.flatMap((sampling) =>
              sampling.randint(1, maxBootstrappedDemos)
            ))
          return (yield* BootstrapFewShot.run(
            new BootstrapFewShot.Options({
              module: original,
              trainset,
              metric: options.metric,
              maxRounds: options.maxRounds ?? 1,
              maxBootstrappedDemos: cap,
              maxLabeledDemos,
              metricThreshold: options.metricThreshold ?? Option.none(),
              maxErrors: options.maxErrors ?? Option.none(),
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
        const evaluation = yield* Evaluate.run(
          new Evaluate.Options({
            module: program,
            examples: options.valset ?? options.trainset,
            metrics: { bootstrapRS: options.metric },
            concurrency: 1,
            maxErrors: options.maxErrors ?? Option.none()
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
          Option.isNone(previous) || candidate.score > previous.value.score ? Option.some(candidate) : previous)
      }))
    const winner = Option.getOrThrow(yield* Ref.get(best))
    return new Optimized.Result({
      program: Module.bound(options.module, winner.parameters),
      parameters: winner.parameters,
      report: new Report({ candidates: yield* Ref.get(candidates), winnerSeed: winner.seed })
    })
  })
