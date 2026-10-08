/** Per-example evaluation diagnostics corresponding to DSPy's provide_traceback. @internal */
import { Boolean as Bool, Cause, Effect, Inspectable, Match, Predicate, Schema, Struct } from "effect"
import type { TooManyErrors } from "../../../Evaluate.js"
import { Metric } from "../../../Metric.js"
import { Module } from "../../../Module.js"

const Tagged = Schema.Struct({ _tag: Schema.String })
const Described = Schema.Struct({ message: Schema.String })

// With traceback the line is accompanied by the failure Cause.
const failureMessage = "MIPROv2 evaluation example failed"
// Without traceback, DSPy's ParallelExecutor appends this hint to each failed item's log line.
const hintMessage = "MIPROv2 evaluation example failed. Set provideTraceback: true for traceback."
const cancelledMessage = "MIPROv2 evaluation failed"

const annotations = (input: unknown, error: unknown) => ({
  input: Inspectable.toStringUnknown(input, 0),
  errorTag: Match.value(error).pipe(
    Match.when(Schema.is(Tagged), (value) => value._tag),
    Match.orElse(() => "UnknownEvaluationError")
  ),
  errorMessage: Match.value(error).pipe(
    Match.when(Predicate.isString, (message) => message),
    Match.when(Schema.is(Described), (value) => value.message),
    Match.orElse(() => Inspectable.toStringUnknown(error))
  )
})

/**
 * Logs one failed example at error level, annotated with its input and typed failure. Without
 * traceback the line carries DSPy's hint and no cause; with traceback the full Cause, including the
 * error's stack, accompanies the line. Defects and interruption are not example failures: they are
 * not logged here and propagate unchanged.
 */
const logFailure = (provideTraceback: boolean, input: unknown) => <E>(cause: Cause.Cause<E>) =>
  Bool.match(provideTraceback, {
    onFalse: () => Effect.logError(hintMessage),
    onTrue: () => Effect.logError(failureMessage, cause)
  }).pipe(Effect.annotateLogs(annotations(input, Cause.squash(cause))))

/** Module whose forward logs each expected failure before Evaluate records it. @internal */
export const diagnoseModule = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module<I, O, E, R>,
  provideTraceback: boolean
): Module<I, O, E, R> =>
  new Module(Struct.assign(module, {
    forward: (input: Schema.Schema.Type<Schema.Struct<I>>) =>
      module.forward(input).pipe(Effect.tapCauseIf(Cause.hasFails, logFailure(provideTraceback, input)))
  }))

/** Metric whose expected failures are logged with the scored example's input. @internal */
export const diagnoseMetric = <ME, MR>(metric: Metric<ME, MR>, provideTraceback: boolean): Metric<ME, MR> =>
  new Metric({
    name: metric.name,
    score: (example, prediction, context) =>
      metric.score(example, prediction, context).pipe(
        Effect.tapCauseIf(Cause.hasFails, logFailure(provideTraceback, example.input))
      )
  })

/** Logs an evaluation cancelled by its error budget; DSPy always logs this with exc_info. @internal */
export const logCancelled = (error: TooManyErrors) =>
  Effect.logError(cancelledMessage, Cause.fail(error)).pipe(
    Effect.annotateLogs({ errorTag: error._tag, count: error.count, limit: error.limit })
  )
