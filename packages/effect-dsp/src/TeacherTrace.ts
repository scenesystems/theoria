/**
 * Collects scored teacher executions without changing caller parameters.
 * TeacherTrace uses supplied demonstrations without prewarming. Optimizers such
 * as BootstrapFewShot treat boundParameters as a compiled teacher and prewarm
 * default or plain teachers through LabeledFewShot before collection.
 * @since 0.7.0
 * @module
 */
import * as ModelBinder from "@scenesystems/effect-lm/ModelBinder"
import * as ModelSettings from "@scenesystems/effect-lm/ModelSettings"
import * as Emitter from "@scenesystems/effect-study/Emitter"
import * as Evaluation from "@scenesystems/effect-study/Evaluation"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Data,
  Effect,
  Inspectable,
  Match,
  Number as Num,
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
import { RolloutRef } from "./internal/cache/rollout.js"
import { CurrentRole } from "./internal/modelRole.js"
import { ScopedSettings } from "./internal/module/predict/scope.js"
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
  demosByPredictor: Schema.Record(Predictor.Path, Schema.Chunk(Demonstration))
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

/** Teacher execution lifecycle, emitted when each domain action completes. @since 0.7.0 @category events */
export const Event = Schema.Union([
  Schema.TaggedStruct("RoundStarted", { round: Schema.Int }),
  Schema.TaggedStruct("ExampleAccepted", Accepted.fields),
  Schema.TaggedStruct("ExampleRejected", Rejected.fields),
  Schema.TaggedStruct("RoundCompleted", { round: Schema.Int, acceptedCount: Schema.Int, rejectedCount: Schema.Int })
])

/** Teacher execution event. @since 0.7.0 @category events */
export type Event = typeof Event.Type

/** Teacher event constructors and exhaustive matching. @since 0.7.0 @category events */
export const events = Data.taggedEnum<Event>()

/** Awaited observer; checked observer failures never consume the model/metric budget. @since 0.7.0 @category models */
export type EventSink<E = never, R = never> = (event: Event) => Effect.Effect<void, E, R>

/** Discards teacher events. @since 0.7.0 @category constants */
export const noEvents: EventSink = () => Effect.void

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

/** Internal signal: the maxErrors budget was reached by an example's attempt. */
class Exhausted extends Data.TaggedError("@scenesystems/effect-dsp/TeacherTrace/Exhausted") {}

/** Teacher collection policy. Defaults: bound student, one round, one worker,
 * no score threshold and no error limit. A zero threshold behaves like an absent
 * one (DSPy's truthiness test): nonzero scores pass. stopWhen is consulted before
 * each example starts; already-running examples drain normally.
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
 * Traversal is example-major, as in DSPy: each example is attempted for up to
 * maxRounds rounds, stopping at its first acceptance, before the next example
 * starts. Rounds after the first use rollout `round` and temperature 1; role,
 * settings and rollout are scoped before predictor cache keys are formed. Every
 * expected attempt failure is retained and counts toward maxErrors; reaching the
 * limit stops new attempts, drains running ones, and fails with TooManyErrors.
 * RoundStarted is emitted when the first example reaches a round; RoundCompleted
 * events follow traversal with counts cumulative through that round.
 * @since 0.7.0
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
    const teacher = Option.getOrElse(Option.flatten(Option.fromUndefinedOr(options.teacher)), () =>
      Module.bound(options.student, studentParameters))
    yield* Effect.failSync(() =>
      new IncompatibleTeacher({ message: "Teacher and student must be distinct executable programs" })
    )
      .pipe(Effect.when(Effect.succeed(teacher === options.student)))
    const parameters = yield* ParameterSet.snapshot(teacher)
    const studentRefs = Arr.fromIterable(ModuleGraph.predictors(options.student))
    const teacherRefs = Arr.fromIterable(ModuleGraph.predictors(teacher))
    yield* Effect.failSync(() =>
      new IncompatibleTeacher({
        message: "Teacher predictor identities and signatures must match the student"
      })
    ).pipe(Effect.when(Effect.succeed(
      studentRefs.length !== teacherRefs.length || Arr.some(studentRefs, (student, index) =>
        Option.match(Arr.get(teacherRefs, index), {
          onNone: () =>
            true,
          onSome: (other) =>
            student.path !== other.path || student.name !== other.name
        }))
    )))
    yield* Effect.forEach(studentRefs, (student, index) =>
      Effect.gen(function*() {
        const other = Option.getOrThrow(Arr.get(teacherRefs, index))
        const studentDigest = yield* student.signatureDigest(
          Option.getOrThrow(Record.get(studentParameters, student.path))
        )
        const teacherDigest = yield* other.signatureDigest(Option.getOrThrow(Record.get(parameters, other.path)))
        yield* Effect.failSync(() =>
          new IncompatibleTeacher({ message: `Teacher signature differs at ${student.path}` })
        )
          .pipe(Effect.when(Effect.succeed(studentDigest !== teacherDigest)))
      }))
    const rows = yield* Effect.forEach(
      options.trainset,
      (example) => Example.id(example).pipe(Effect.map((id) => ({ example, id })))
    )
    const maxRounds = Option.getOrElse(Option.fromUndefinedOr(options.maxRounds), () => 1)
    const limit = Option.flatten(Option.fromUndefinedOr(options.maxErrors))
    // DSPy tests `if self.metric_threshold:`, so absent and zero thresholds both use score truthiness.
    const threshold = Option.filter(Option.flatten(Option.fromUndefinedOr(options.threshold)), (value) => value !== 0)
    const teacherSettings = Option.getOrElse(Option.fromUndefinedOr(options.teacherSettings), () => ModelSettings.empty)
    // Live acceptances drive stopWhen; returned evidence is assembled in input order.
    const live = yield* Ref.make(Chunk.empty<Accepted>())
    const errors = yield* Ref.make(0)
    const exhausted = yield* Ref.make(false)
    const roundsStarted = yield* Ref.make(0)
    // Expected observer failures are carried outside runCollecting, not counted as model failures.
    // Already-running examples drain; no new attempts start after the first observer failure.
    const observerFailure = yield* Ref.make(Option.none<EE>())
    const emitExample = (event: Event) =>
      observe(event).pipe(
        Effect.catch((error) =>
          Ref.update(observerFailure, (previous) => Option.orElse(previous, () => Option.some(error)))
        )
      )
    const halted = Effect.all([Ref.get(observerFailure), Ref.get(exhausted)]).pipe(
      Effect.map(([failure, spent]) => Bool.or(Option.isSome(failure), spent))
    )
    // Predict merges ScopedSettings before cache keys are formed. LM operations that build
    // their own requests (ReAct turns, plain text generation) receive them through this binder.
    const binder = yield* ModelBinder.Current
    const teacherBinder = new ModelBinder.Binder({
      bind: (request) => (effect) =>
        Effect.flatMap(ScopedSettings, (scoped) =>
          binder.bind(
            new ModelBinder.Request({
              role: request.role,
              settings: ModelSettings.merge(request.settings, scoped),
              rolloutId: request.rolloutId
            })
          )(effect))
    })
    // DSPy bootstrap.py: rounds after the first use lm.copy(rollout_id=round, temperature=1.0).
    // Role, settings and rollout are scoped before any predictor forms its cache key.
    const teacherScope = (round: number) => <A, X, Y>(effect: Effect.Effect<A, X, Y>) =>
      Effect.flatMap(RolloutRef, (rollout) =>
        effect.pipe(
          ModelBinder.withBinder(teacherBinder),
          Effect.provideService(CurrentRole, "teacher"),
          Effect.provideService(
            ScopedSettings,
            ModelSettings.merge(
              teacherSettings,
              Bool.match(round > 0, {
                onTrue: () => new ModelSettings.ModelSettings({ temperature: 1 }),
                onFalse: () => ModelSettings.empty
              })
            )
          ),
          Effect.provideService(
            RolloutRef,
            Bool.match(round > 0, { onTrue: () => Option.some(round), onFalse: () => rollout })
          )
        ))
    const attempt = (row: (typeof rows)[number], round: number) =>
      Effect.gen(function*() {
        const overlay = Record.map(parameters, (parameters) =>
          ModuleParameters.withDemos(
            parameters,
            Arr.filter(parameters.demos, (demo) => !Option.contains(row.id)(demo.exampleId))
          ))
        const input = yield* Schema.decodeEffect(teacher.signature.inputSchema)(row.example.input)
        const prediction = yield* Module.call(teacher, input).pipe(
          Module.withParameters(overlay),
          teacherScope(round)
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
        const passes = Option.match(threshold, {
          onNone: () => score.value !== 0,
          onSome: (minimum) => score.value >= minimum
        })
        return yield* Bool.match(passes, {
          onFalse: () =>
            Effect.succeed<Accepted | Rejected>(
              new Rejected({
                exampleId: row.id,
                round,
                reason: "score",
                score: Option.some(score),
                failure: Option.none()
              })
            ),
          onTrue: () =>
            Effect.gen(function*() {
              const demos = yield* Effect.forEach(studentRefs, (predictor) =>
                Effect.gen(function*() {
                  const entries = Chunk.filter(
                    prediction.trace.selected,
                    (entry) => entry.outcome === "completed" && entry.moduleName === predictor.name
                  )
                  const values = yield* Effect.forEach(entries, (entry) =>
                    predictor.demonstrationCodec.decodeDocuments(entry.input, entry.output).pipe(
                      Effect.map((demo) =>
                        new Demonstration(
                          Struct.assign(demo, { exampleId: Option.some(row.id), augmented: true })
                        )
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
              yield* Ref.update(live, (entries) => Chunk.append(entries, result))
              return result
            })
        })
      })
    // A round starts when the first example reaches that attempt index.
    const startRound = (round: number) =>
      Ref.modify(roundsStarted, (started) =>
        Bool.match(round >= started, {
          onTrue: () => Tuple.make(true, Num.increment(round)),
          onFalse: () => Tuple.make(false, started)
        })).pipe(
          Effect.flatMap((fresh) =>
            emitExample(events.RoundStarted({ round })).pipe(Effect.when(Effect.succeed(fresh)))
          )
        )
    // DSPy bootstrap.py is example-major: each example retries through its rounds until
    // accepted before the next example starts. Every expected failure counts toward maxErrors.
    const visit = (row: (typeof rows)[number]) =>
      Effect.gen(function*() {
        const outcomes = yield* Ref.make(Chunk.empty<Accepted | Rejected>())
        const settled = yield* Ref.make(false)
        yield* Effect.forEach(Arr.makeBy(maxRounds, (round) => round), (round) =>
          Effect.gen(function*() {
            const skip = Bool.or(yield* halted, yield* Ref.get(settled))
            yield* Bool.match(skip, {
              onTrue: () => Effect.void,
              onFalse: () =>
                Effect.gen(function*() {
                  yield* startRound(round)
                  const outcome = yield* Effect.result(attempt(row, round))
                  yield* Result.match(outcome, {
                    onFailure: (failure) =>
                      Effect.gen(function*() {
                        const rejection = new Rejected({
                          exampleId: row.id,
                          round,
                          reason: "failure",
                          score: Option.none(),
                          failure: Option.some(Inspectable.toStringUnknown(failure))
                        })
                        const count = yield* Ref.updateAndGet(errors, Num.increment)
                        const reached = Option.exists(limit, (maximum) => count >= maximum)
                        yield* Ref.set(exhausted, true).pipe(Effect.when(Effect.succeed(reached)))
                        yield* Ref.update(outcomes, Chunk.append(rejection))
                        yield* emitExample(events.ExampleRejected(rejection))
                        yield* Effect.fail(new Exhausted()).pipe(Effect.when(Effect.succeed(reached)))
                      }),
                    onSuccess: (value) =>
                      Effect.gen(function*() {
                        yield* Ref.update(outcomes, Chunk.append(value))
                        yield* Match.value(value).pipe(
                          Match.when(
                            Match.instanceOfUnsafe(Accepted),
                            (entry) =>
                              Ref.set(settled, true).pipe(Effect.andThen(emitExample(events.ExampleAccepted(entry))))
                          ),
                          Match.orElse((entry) => emitExample(events.ExampleRejected(entry)))
                        )
                      })
                  })
                })
            })
          }), { discard: true })
        return yield* Ref.get(outcomes)
      })
    const evaluation = yield* Evaluation.runCollecting(rows, (row) =>
      Effect.gen(function*() {
        const entries = yield* Ref.get(live)
        const stopped = Bool.or(
          yield* halted,
          Option.exists(Option.fromUndefinedOr(options.stopWhen), (stop) => stop(entries))
        )
        return yield* Bool.match(stopped, {
          onTrue: () => Effect.succeed(Chunk.empty<Accepted | Rejected>()),
          onFalse: () => visit(row)
        })
      }), {
      concurrency: Option.getOrElse(Option.fromUndefinedOr(options.concurrency), () => 1),
      // Only an exhausted maxErrors budget fails an example: stop admitting, drain, then fail.
      maxFailures: Option.some(0),
      onFailure: "record"
    }).pipe(Effect.result)
    const failedObserver = yield* Ref.get(observerFailure)
    yield* Option.match(failedObserver, { onNone: () => Effect.void, onSome: Effect.fail })
    const trials = yield* Result.match(evaluation, {
      onSuccess: Effect.succeed,
      onFailure: () =>
        Effect.gen(function*() {
          const maximum = yield* Effect.fromOption(limit).pipe(Effect.orDie)
          return yield* new TooManyErrors({ count: yield* Ref.get(errors), limit: maximum })
        })
    })
    const outcomes = Chunk.flatMap(trials, (trial) =>
      Match.value(trial.state).pipe(
        Match.tag("Completed", (state) => state.value),
        Match.tag("Failed", () => Chunk.empty<Accepted | Rejected>()),
        Match.exhaustive
      ))
    const accepted = Chunk.filter(outcomes, Schema.is(Accepted))
    const rejected = Chunk.filter(outcomes, Schema.is(Rejected))
    // Rounds complete together once traversal ends; counts are cumulative through each round.
    yield* Effect.forEach(Arr.makeBy(yield* Ref.get(roundsStarted), (round) => round), (round) =>
      observe(
        events.RoundCompleted({
          round,
          acceptedCount: Chunk.size(Chunk.filter(accepted, (entry) => entry.round <= round)),
          rejectedCount: Chunk.size(Chunk.filter(rejected, (entry) => entry.round <= round))
        })
      ), { discard: true })
    return new Collected({ accepted, rejected })
  })

/** Streams teacher lifecycle events as collection executes. @since 0.7.0 @category constructors */
export const stream = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R, ME, MR>(
  options: Options<I, O, E, R, ME, MR>
) => Emitter.toStream((emit: EventSink) => collect(options, emit))
