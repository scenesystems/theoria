/**
 * Collects scored teacher executions without changing caller parameters.
 * @since 0.7.0
 * @module
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import * as Evaluation from "@scenesystems/effect-study/Evaluation"
import { Array as Arr, Chunk, Data, Effect, Inspectable, Option, Record, Ref, Schema, Struct, Tuple } from "effect"
import { Demonstration } from "./Demonstration.js"
import * as Example from "./Example.js"
import { maxFailures } from "./internal/maxErrors.js"
import * as Metric from "./Metric.js"
import * as Module from "./Module.js"
import * as ModuleGraph from "./ModuleGraph.js"
import * as ModuleParameters from "./ModuleParameters.js"
import * as ParameterSet from "./ParameterSet.js"
import * as Predictor from "./Predictor.js"
import * as Trace from "./Trace.js"

/** A successful teacher execution, retaining every completed predictor call.
 * @since 0.7.0
 * @category models
 */
export class Accepted extends Schema.Class<Accepted>("@scenesystems/effect-dsp/TeacherTrace/Accepted")({
  exampleId: Example.Id,
  round: Schema.Int,
  trace: Trace.Program,
  score: Metric.Score,
  demosByPredictor: Schema.Record(Predictor.Id, Schema.Chunk(Demonstration))
}) {}

/** A rejected score or expected execution failure; defects remain defects.
 * @since 0.7.0
 * @category models
 */
export class Rejected extends Schema.Class<Rejected>("@scenesystems/effect-dsp/TeacherTrace/Rejected")({
  exampleId: Example.Id,
  round: Schema.Int,
  reason: Schema.Literals(["score", "failure"]),
  score: Schema.Option(Metric.Score),
  failure: Schema.Option(Schema.String)
}) {}

/** Ordered accepted and rejected teacher evidence.
 * @since 0.7.0
 * @category models
 */
export class Collected extends Schema.Class<Collected>("@scenesystems/effect-dsp/TeacherTrace/Collected")({
  accepted: Schema.Chunk(Accepted),
  rejected: Schema.Chunk(Rejected)
}) {}

/** Teacher and student must have matching predictor identities and signatures.
 * @since 0.7.0
 * @category errors
 */
export class IncompatibleTeacher extends Schema.TaggedError<IncompatibleTeacher>(
  "@scenesystems/effect-dsp/TeacherTrace/IncompatibleTeacher"
)("IncompatibleTeacher", { message: Schema.String }) {}

/** The DSPy error budget was reached after draining in-flight work.
 * @since 0.7.0
 * @category errors
 */
export class TooManyErrors extends Schema.TaggedError<TooManyErrors>(
  "@scenesystems/effect-dsp/TeacherTrace/TooManyErrors"
)("TooManyErrors", { count: Schema.Int, limit: Schema.Int }) {}

/** Teacher collection policy. Defaults: bound student, one round, one worker,
 * no score threshold and no error limit. stopWhen prevents new work from starting;
 * already-running examples drain normally.
 * @since 0.7.0
 * @category models
 */
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E = never,
  R = never,
  ME = never,
  MR = never
> extends Data.Class<{
  readonly student: Module.Module<I, O, E, R>
  readonly teacher?: Option.Option<Module.Module<I, O, E, R>>
  readonly teacherSettings?: ModelSettings.ModelSettings
  readonly trainset: Chunk.Chunk<Example.Example>
  readonly metric: Metric.Metric<ME, MR>
  readonly threshold?: Option.Option<number>
  readonly maxErrors?: Option.Option<number>
  readonly maxRounds?: number
  readonly concurrency?: number
  readonly stopWhen?: (accepted: Chunk.Chunk<Accepted>) => boolean
}> {}

/** Deterministically selects the first call per predictor within each example.
 * This is not DSPy's hash-seeded repeated-call selection policy.
 * @since 0.7.0
 * @category combinators
 */
export const firstPerPredictor = (accepted: Accepted): Accepted =>
  new Accepted(Struct.assign(accepted, {
    demosByPredictor: Record.map(accepted.demosByPredictor, (demos) => Chunk.take(demos, 1))
  }))

/** Executes teachers under leave-one-out parameter overlays and teacher role.
 * Successful examples are not retried in later rounds; rejected examples are.
 * Every expected example failure is retained unless the error budget is reached.
 * @since 0.7.0
 * @category operations
 */
export const collect = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R, ME, MR>(
  options: Options<I, O, E, R, ME, MR>
) =>
  Effect.gen(function*() {
    const studentParameters = yield* ParameterSet.snapshot(options.student)
    const teacher = Option.getOrElse(options.teacher ?? Option.none(), () =>
      Module.bound(options.student, studentParameters))
    const studentRefs = Arr.fromIterable(ModuleGraph.predictors(options.student))
    const teacherRefs = Arr.fromIterable(ModuleGraph.predictors(teacher))
    if (
      studentRefs.length !== teacherRefs.length || Arr.some(studentRefs, (student, index) => {
        const other = teacherRefs[index]
        return !other || student.id !== other.id || student.signature.description !== other.signature.description ||
          student.signature.instructions !== other.signature.instructions
      })
    ) {
      return yield* new IncompatibleTeacher({
        message: "Teacher predictor identities and signatures must match the student"
      })
    }
    yield* Effect.forEach(studentRefs, (student, index) =>
      Effect.gen(function*() {
        const other = Option.getOrThrow(Arr.get(teacherRefs, index))
        if ((yield* student.signatureDigest) !== (yield* other.signatureDigest)) {
          return yield* new IncompatibleTeacher({ message: `Teacher signature differs at ${student.id}` })
        }
      }))
    const parameters = yield* ParameterSet.snapshot(teacher)
    const rows = yield* Effect.forEach(options.trainset, (example) =>
      Example.id(example).pipe(Effect.map((id) => ({ example, id }))))
    const accepted = yield* Ref.make(Chunk.empty<Accepted>())
    const rejected = yield* Ref.make(Chunk.empty<Rejected>())
    const errors = yield* Ref.make(0)
    const binder = yield* ModelBinder.Current
    yield* Effect.forEach(
      Arr.makeBy(options.maxRounds ?? 1, (round) =>
        round),
      (round) =>
        Effect.gen(function*() {
          const completed = yield* Ref.get(accepted)
          if (options.stopWhen?.(completed)) {
            return
          }
          const failuresBefore = yield* Ref.get(errors)
          const remaining = Arr.filter(rows, (row) =>
            !Chunk.some(completed, (entry) =>
              entry.exampleId === row.id))
          const trials = yield* Evaluation.runCollecting(remaining, (row) =>
            Effect.gen(function*() {
              if (options.stopWhen?.(yield* Ref.get(accepted))) return Option.none<Accepted | Rejected>()
              const overlay = Record.map(parameters, (params) =>
                ModuleParameters.withDemos(
                  params,
                  Arr.filter(params.demos, (demo) => !Option.contains(row.id)(demo.exampleId))
                ))
              const input = yield* Schema.decodeEffect(teacher.signature.inputSchema)(row.example.input)
              const teacherBinder = new ModelBinder.Binder({
                bind: (request) =>
                  binder.bind(
                    new ModelBinder.Request({
                      role: "teacher",
                      settings: ModelSettings.merge(
                        request.settings,
                        ModelSettings.merge(
                          options.teacherSettings ?? ModelSettings.empty,
                          round > 0 ? new ModelSettings.ModelSettings({ temperature: 1 }) : ModelSettings.empty
                        )
                      ),
                      rolloutId: round > 0 ? Option.some(round) : request.rolloutId
                    })
                  )
              })
              const prediction = yield* Module.call(teacher, input).pipe(
                Module.withParameters(overlay),
                ModelBinder.withBinder(teacherBinder)
              )
              const score = yield* options.metric.score(
                row.example,
                prediction,
                new Metric.Context({
                  phase: "bootstrap",
                  trace: Option.some(prediction.trace),
                  target: Option.none()
                })
              )
              const passes = Option.match(options.threshold ?? Option.none(), {
                onNone: () => score.value !== 0,
                onSome: (threshold) => score.value >= threshold
              })
              if (!passes) {
                return Option.some(
                  new Rejected({
                    exampleId: row.id,
                    round,
                    reason: "score",
                    score: Option.some(score),
                    failure: Option.none()
                  })
                )
              }
              const demos = yield* Effect.forEach(studentRefs, (predictor) =>
                Effect.gen(function*() {
                  const entries = Chunk.filter(prediction.trace.selected, (entry) =>
                    entry.outcome === "completed" && entry.moduleName === predictor.name)
                  const values = yield* Effect.forEach(entries, (entry) =>
                    predictor.demonstrationCodec.decodeDocuments(entry.input, entry.output).pipe(
                      Effect.map((demo) =>
                        new Demonstration(Struct.assign(demo, { exampleId: Option.some(row.id) }))
                      )
                    ))
                  return Tuple.make(predictor.id, Chunk.fromIterable(values))
                }))
              const result = new Accepted({
                exampleId: row.id,
                round,
                trace: prediction.trace,
                score,
                demosByPredictor: Record.fromEntries(demos)
              })
              yield* Ref.update(accepted, (entries) => Chunk.append(entries, result))
              return Option.some(result)
            }), {
            concurrency: options.concurrency ?? 1,
            maxFailures: Option.map(maxFailures(options.maxErrors ?? Option.none()), (limit) => limit - failuresBefore),
            onFailure: "record"
          }).pipe(Effect.mapError((error) =>
            new TooManyErrors({
              count: failuresBefore + error.count,
              limit: Option.getOrElse(options.maxErrors ?? Option.none(), () => error.limit + failuresBefore + 1)
            })
          ))
          yield* Ref.set(accepted, completed)
          yield* Effect.forEach(trials, (trial) =>
            Effect.gen(function*() {
              if (trial.state._tag === "Failed") {
                const failure = Inspectable.toStringUnknown(trial.state.error)
                yield* Ref.update(errors, (count) => count + 1)
                yield* Ref.update(rejected, (entries) =>
                  Chunk.append(
                    entries,
                    new Rejected({
                      exampleId: trial.config.id,
                      round,
                      reason: "failure",
                      score: Option.none(),
                      failure: Option.some(failure)
                    })
                  ))
              } else if (Option.isSome(trial.state.value) && trial.state.value.value instanceof Rejected) {
                const value = trial.state.value.value
                yield* Ref.update(rejected, (entries) => Chunk.append(entries, value))
              } else if (Option.isSome(trial.state.value) && trial.state.value.value instanceof Accepted) {
                const value = trial.state.value.value
                yield* Ref.update(accepted, (entries) => Chunk.append(entries, value))
              }
            }))
        })
    )
    return new Collected({ accepted: yield* Ref.get(accepted), rejected: yield* Ref.get(rejected) })
  })
