/**
 * Collects scored teacher executions without changing caller parameters.
 * TeacherTrace uses supplied demonstrations without prewarming. Optimizers such
 * as BootstrapFewShot treat boundParameters as a compiled teacher and prewarm
 * default or plain teachers through LabeledFewShot before collection.
 * @since 0.6.0
 * @module
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import * as Emitter from "@scenesystems/effect-study/Emitter"
import * as Evaluation from "@scenesystems/effect-study/Evaluation"
import {
  Array as Arr,
  Chunk,
  Data,
  Effect,
  Inspectable,
  Option,
  Record,
  Ref,
  Result,
  Schema,
  Struct,
  Tuple
} from "effect"
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
 * @since 0.6.0
 * @category models
 */
export class Accepted extends Schema.Class<Accepted>("@scenesystems/effect-dsp/TeacherTrace/Accepted")({
  exampleId: Example.Id,
  round: Schema.Int,
  trace: Trace.Program,
  score: Metric.Score,
  demosByPredictor: Schema.Record(Predictor.Path, Schema.Chunk(Demonstration))
}) {}

/** A rejected score or expected execution failure; defects remain defects.
 * @since 0.6.0
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
 * @since 0.6.0
 * @category models
 */
export class Collected extends Schema.Class<Collected>("@scenesystems/effect-dsp/TeacherTrace/Collected")({
  accepted: Schema.Chunk(Accepted),
  rejected: Schema.Chunk(Rejected)
}) {}

/** Teacher execution lifecycle, emitted when each domain action completes. @since 0.6.0 @category events */
export const Event = Schema.Union([
  Schema.TaggedStruct("RoundStarted", { round: Schema.Int }),
  Schema.TaggedStruct("ExampleAccepted", Accepted.fields),
  Schema.TaggedStruct("ExampleRejected", Rejected.fields),
  Schema.TaggedStruct("RoundCompleted", { round: Schema.Int, acceptedCount: Schema.Int, rejectedCount: Schema.Int })
])

/** Teacher execution event. @since 0.6.0 @category events */
export type Event = typeof Event.Type

/** Teacher event constructors and exhaustive matching. @since 0.6.0 @category events */
export const events = Data.taggedEnum<Event>()

/** Awaited observer; checked observer failures never consume the model/metric budget. @since 0.6.0 @category models */
export type EventSink<E = never, R = never> = (event: Event) => Effect.Effect<void, E, R>

/** Discards teacher events. @since 0.6.0 @category constants */
export const noEvents: EventSink = () => Effect.void

/** Teacher and student must have matching predictor identities and signatures.
 * @since 0.6.0
 * @category errors
 */
export class IncompatibleTeacher extends Schema.TaggedError<IncompatibleTeacher>(
  "@scenesystems/effect-dsp/TeacherTrace/IncompatibleTeacher"
)("IncompatibleTeacher", { message: Schema.String }) {}

/** The DSPy error budget was reached after draining in-flight work.
 * @since 0.6.0
 * @category errors
 */
export class TooManyErrors extends Schema.TaggedError<TooManyErrors>(
  "@scenesystems/effect-dsp/TeacherTrace/TooManyErrors"
)("TooManyErrors", { count: Schema.Int, limit: Schema.Int }) {}

/** Teacher collection policy. Defaults: bound student, one round, one worker,
 * no score threshold and no error limit. stopWhen prevents new work from starting;
 * already-running examples drain normally.
 * @since 0.6.0
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
 * @since 0.6.0
 * @category combinators
 */
export const firstPerPredictor = (accepted: Accepted): Accepted =>
  new Accepted(Struct.assign(accepted, {
    demosByPredictor: Record.map(accepted.demosByPredictor, (demos) => Chunk.take(demos, 1))
  }))

/** Executes teachers under leave-one-out parameter overlays and teacher role.
 * Successful examples are not retried in later rounds; rejected examples are.
 * Every expected example failure is retained unless the error budget is reached.
 * @since 0.6.0
 * @category operations
 */
export const collect = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R,
  ME,
  MR,
  EE = never,
  ER = never
>(
  options: Options<I, O, E, R, ME, MR>,
  observe: EventSink<EE, ER> = noEvents
) =>
  Effect.gen(function*() {
    const studentParameters = yield* ParameterSet.snapshot(options.student)
    const teacher = Option.getOrElse(options.teacher ?? Option.none(), () =>
      Module.bound(options.student, studentParameters))
    if (teacher === options.student) {
      return yield* new IncompatibleTeacher({ message: "Teacher and student must be distinct executable programs" })
    }
    const parameters = yield* ParameterSet.snapshot(teacher)
    const studentRefs = Arr.fromIterable(ModuleGraph.predictors(options.student))
    const teacherRefs = Arr.fromIterable(ModuleGraph.predictors(teacher))
    if (
      studentRefs.length !== teacherRefs.length || Arr.some(studentRefs, (student, index) => {
        const other = teacherRefs[index]
        return !other || student.path !== other.path || student.name !== other.name
      })
    ) {
      return yield* new IncompatibleTeacher({
        message: "Teacher predictor identities and signatures must match the student"
      })
    }
    yield* Effect.forEach(studentRefs, (student, index) =>
      Effect.gen(function*() {
        const other = Option.getOrThrow(Arr.get(teacherRefs, index))
        const studentDigest = yield* student.signatureDigest(
          Option.getOrThrow(Record.get(studentParameters, student.path))
        )
        const teacherDigest = yield* other.signatureDigest(Option.getOrThrow(Record.get(parameters, other.path)))
        if (studentDigest !== teacherDigest) {
          return yield* new IncompatibleTeacher({ message: `Teacher signature differs at ${student.path}` })
        }
      }))
    const rows = yield* Effect.forEach(options.trainset, (example) =>
      Example.id(example).pipe(Effect.map((id) => ({ example, id }))))
    const accepted = yield* Ref.make(Chunk.empty<Accepted>())
    const rejected = yield* Ref.make(Chunk.empty<Rejected>())
    const errors = yield* Ref.make(0)
    // Expected observer failures are carried outside runCollecting, not counted as model failures.
    // Already-running examples drain; no new examples start after the first observer failure.
    const observerFailure = yield* Ref.make(Option.none<EE>())
    const emitExample = (event: Event) =>
      observe(event).pipe(Effect.catch((error) =>
        Ref.update(observerFailure, (previous) =>
          Option.orElse(previous, () =>
            Option.some(error)))
      ))
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
          yield* observe(events.RoundStarted({ round }))
          const failuresBefore = yield* Ref.get(errors)
          const remaining = Arr.filter(rows, (row) =>
            !Chunk.some(completed, (entry) =>
              entry.exampleId === row.id))
          const evaluation = yield* Evaluation.runCollecting(remaining, (row) =>
            Effect.gen(function*() {
              if (Option.isSome(yield* Ref.get(observerFailure)) || options.stopWhen?.(yield* Ref.get(accepted))) {
                return Option.none<Accepted | Rejected>()
              }
              const outcome = yield* Effect.gen(function*() {
                const overlay = Record.map(parameters, (parameters) =>
                  ModuleParameters.withDemos(
                    parameters,
                    Arr.filter(parameters.demos, (demo) => !Option.contains(row.id)(demo.exampleId))
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
                  return Option.some<Accepted | Rejected>(
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
                          new Demonstration(Struct.assign(demo, { exampleId: Option.some(row.id), augmented: true }))
                        )
                      ))
                    return Tuple.make(predictor.path, Chunk.fromIterable(values))
                  }))
                const result = new Accepted({
                  exampleId: row.id,
                  round,
                  trace: prediction.trace,
                  score,
                  demosByPredictor: Record.fromEntries(demos)
                })
                yield* Ref.update(accepted, (entries) =>
                  Chunk.append(entries, result))
                return Option.some<Accepted | Rejected>(result)
              }).pipe(Effect.result)
              if (Result.isFailure(outcome)) {
                yield* emitExample(
                  events.ExampleRejected({
                    exampleId: row.id,
                    round,
                    reason: "failure",
                    score: Option.none(),
                    failure: Option.some(Inspectable.toStringUnknown(outcome.failure))
                  })
                )
                if (Option.isSome(yield* Ref.get(observerFailure))) return Option.none<Accepted | Rejected>()
                return yield* Effect.fail(outcome.failure)
              }
              if (Option.isSome(outcome.success)) {
                const value = outcome.success.value
                yield* emitExample(
                  value instanceof Accepted ? events.ExampleAccepted(value) : events.ExampleRejected(value)
                )
              }
              return outcome.success
            }), {
            concurrency: options.concurrency ?? 1,
            maxFailures: Option.map(maxFailures(options.maxErrors ?? Option.none()), (limit) => limit - failuresBefore),
            onFailure: "record"
          }).pipe(
            Effect.mapError((error) =>
              new TooManyErrors({
                count: failuresBefore + error.count,
                limit: Option.getOrElse(options.maxErrors ?? Option.none(), () => error.limit + failuresBefore + 1)
              })
            ),
            Effect.result
          )
          const failedObserver = yield* Ref.get(observerFailure)
          if (Option.isSome(failedObserver)) return yield* Effect.fail(failedObserver.value)
          if (Result.isFailure(evaluation)) return yield* evaluation.failure
          const trials = evaluation.success
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
          yield* observe(
            events.RoundCompleted({
              round,
              acceptedCount: Chunk.size(yield* Ref.get(accepted)),
              rejectedCount: Chunk.size(yield* Ref.get(rejected))
            })
          )
        })
    )
    return new Collected({ accepted: yield* Ref.get(accepted), rejected: yield* Ref.get(rejected) })
  })

/** Streams teacher lifecycle events as collection executes. @since 0.6.0 @category constructors */
export const stream = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R, ME, MR>(
  options: Options<I, O, E, R, ME, MR>
) => Emitter.toStream((emit: EventSink) => collect(options, emit))
