/** Teacher-derived MIPRO demonstration catalogs. @since 0.1.0 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Effect, Equal, Number as Num, Option, Record, Schema } from "effect"
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

const count = (value: number) => Numeric.isFinite(value) ? Num.max(0, Numeric.floor(value)) : 0

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
    const sampling = yield* Sampling.resolve(options.seed ?? 9)
    const labeled = count(options.maxLabeledDemos ?? 4)
    const requestedBootstrap = count(options.maxBootstrappedDemos ?? 4)
    const bootstrapped = Equal.equals(labeled, 0) && Equal.equals(requestedBootstrap, 0) ? 3 : requestedBootstrap
    const catalog = yield* Effect.forEach(
      Arr.makeBy(Num.max(1, count(options.numCandidates)), (index) => Num.subtract(index, 3)),
      (seed) =>
        Effect.gen(function*() {
          if (Equal.equals(seed, -3)) {
            const kind: DemoCandidateKind = "zero-shot"
            return {
              kind,
              parameters: Record.map(before, (parameters, path) =>
                Arr.some(refs, (ref) => Equal.equals(ref.path, path))
                  ? withDemos(parameters, [])
                  : parameters)
            }
          }
          if (Equal.equals(seed, -2) && Num.isGreaterThan(labeled, 0)) {
            const result = yield* LabeledFewShot.run(
              new LabeledFewShot.Options({
                module: original,
                trainset: options.trainset,
                k: labeled
              })
            )
            const kind: DemoCandidateKind = "labels-only"
            return { kind, parameters: result.parameters }
          }
          const unshuffled = Equal.equals(seed, -1)
          const trainset = unshuffled ? options.trainset : yield* sampling.shuffle(options.trainset)
          if (!unshuffled) yield* Schema.decodeEffect(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)))(bootstrapped)
          const cap = unshuffled ? bootstrapped : yield* sampling.randint(1, bootstrapped)
          const result = yield* BootstrapFewShot.run(
            new BootstrapFewShot.Options({
              module: original,
              trainset,
              metric: options.metric ?? Metric.fromSync(() => 1),
              maxBootstrappedDemos: cap,
              maxLabeledDemos: labeled,
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
          )
          const kind: DemoCandidateKind = unshuffled ? "bootstrap-unshuffled" : "bootstrap-shuffled"
          return { kind, parameters: result.parameters }
        })
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
