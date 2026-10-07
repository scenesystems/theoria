/** Teacher-derived MIPRO demonstration catalogs. @since 0.1.0 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Effect,
  Equal,
  Match,
  Number as Num,
  Option,
  Record,
  Schema
} from "effect"
import * as BootstrapFewShot from "../../BootstrapFewShot.js"
import * as LabeledFewShot from "../../LabeledFewShot.js"
import * as Metric from "../../Metric.js"
import {
  DemoCandidate,
  type DemoCandidateKind,
  type GenerateDemoCandidatesOptions,
  PredictorDemoCandidates
} from "../../MIPROv2Candidates.js"
import * as Module from "../../Module.js"
import { predictors } from "../../ModuleGraph.js"
import { withDemos } from "../../ModuleParameters.js"
import * as ParameterSet from "../../ParameterSet.js"
import * as Sampling from "./sampling.js"

const count = (value: number) =>
  Bool.match(Numeric.isFinite(value), { onFalse: () => 0, onTrue: () => Num.max(0, Numeric.floor(value)) })

/**
 * Executes the pinned catalog: reset, labeled (if enabled), unshuffled
 * bootstrap, then shuffled bootstrap. With no labeled capacity, candidate -2
 * also shuffles and bootstraps. Zero-shot optimization still builds proposer
 * evidence with three bootstrapped demonstrations and no labels.
 *
 * @since 0.1.0
 * @category constructors
 */
export const generateDemoCandidates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never,
  ME = never,
  MR = never
>(options: GenerateDemoCandidatesOptions<I, O, E, R, ME, MR>) =>
  Effect.gen(function*() {
    const before = yield* ParameterSet.snapshot(options.module)
    const original = Module.bound(options.module, before)
    const refs = Arr.filter(Arr.fromIterable(predictors(original)), (entry) => !entry.frozen)
    const sampling = yield* Sampling.resolve(Option.getOrElse(Option.fromUndefinedOr(options.seed), () => 9))
    const labeled = count(Option.getOrElse(Option.fromUndefinedOr(options.maxLabeledDemos), () => 4))
    const requestedBootstrap = count(Option.getOrElse(Option.fromUndefinedOr(options.maxBootstrappedDemos), () => 4))
    const bootstrapped = Bool.match(Equal.equals(labeled, 0) && Equal.equals(requestedBootstrap, 0), {
      onFalse: () => requestedBootstrap,
      onTrue: () => 3
    })
    const catalog = yield* Effect.forEach(
      Arr.makeBy(Num.max(1, count(options.numCandidates)), (index) => Num.subtract(index, 3)),
      (seed) =>
        Match.value(seed).pipe(
          Match.when((value: number) => Equal.equals(value, -3), () =>
            Effect.gen(function*() {
              const kind: DemoCandidateKind = "zero-shot"
              return {
                kind,
                parameters: Record.map(before, (parameters, path) =>
                  Bool.match(Arr.some(refs, (ref) => Equal.equals(ref.path, path)), {
                    onFalse: () => parameters,
                    onTrue: () => withDemos(parameters, [])
                  }))
              }
            })),
          Match.when((value: number) =>
            Equal.equals(value, -2) && Num.isGreaterThan(labeled, 0), () =>
            Effect.gen(function*() {
              const result = yield* LabeledFewShot.run(
                new LabeledFewShot.Options({
                  module: original,
                  trainset: options.trainset,
                  k: labeled
                })
              )
              const kind: DemoCandidateKind = "labels-only"
              return { kind, parameters: result.parameters }
            })),
          Match.orElse(() =>
            Effect.gen(function*() {
              const unshuffled = Equal.equals(seed, -1)
              const trainset = yield* Bool.match(unshuffled, {
                onFalse: () =>
                  sampling.shuffle(Chunk.fromIterable(options.trainset)).pipe(Effect.map(Arr.fromIterable)),
                onTrue: () =>
                  Effect.succeed(options.trainset)
              })
              yield* Schema.decodeEffect(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)))(bootstrapped).pipe(
                Effect.when(Effect.succeed(!unshuffled))
              )
              const cap = yield* Bool.match(unshuffled, {
                onFalse: () =>
                  sampling.randint(1, bootstrapped),
                onTrue: () => Effect.succeed(bootstrapped)
              })
              const result = yield* BootstrapFewShot.run(
                new BootstrapFewShot.Options({
                  module: original,
                  trainset,
                  metric: Option.getOrElse(Option.fromUndefinedOr(options.metric), () => Metric.fromSync(() => 1)),
                  maxBootstrappedDemos: cap,
                  maxLabeledDemos: labeled,
                  metricThreshold: Option.getOrElse(
                    Option.fromUndefinedOr(options.metricThreshold),
                    () => Option.none()
                  ),
                  maxErrors: Option.getOrElse(Option.fromUndefinedOr(options.maxErrors), () => Option.none()),
                  ...Option.match(Option.fromUndefinedOr(options.teacher), {
                    onNone: () => ({}),
                    onSome: (teacher) => ({ teacher })
                  }),
                  ...Option.match(Option.fromUndefinedOr(options.teacherSettings), {
                    onNone: () => ({}),
                    onSome: (teacherSettings) => ({ teacherSettings })
                  })
                })
              )
              const kind: DemoCandidateKind = Bool.match(unshuffled, {
                onFalse: () => "bootstrap-shuffled",
                onTrue: () => "bootstrap-unshuffled"
              })
              return { kind, parameters: result.parameters }
            })
          )
        )
    )
    return Arr.map(refs, (ref) =>
      new PredictorDemoCandidates({
        predictorName: ref.name,
        candidates: Arr.map(catalog, (candidate) =>
          new DemoCandidate({
            predictorName: ref.name,
            kind: candidate.kind,
            parameters: Option.getOrThrow(Record.get(candidate.parameters, ref.path))
          }))
      }))
  })
