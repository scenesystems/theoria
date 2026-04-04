/**
 * Dataset evaluation runtime — run a module against labeled examples with
 * composable metrics.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Ref, Stream } from "effect"
import type { Schema } from "effect"
import type { EvaluationEventType } from "./events.js"
import { evaluateKernel, type EvaluateOptions, noEvents } from "./runtime/kernel.js"

/**
 * Report types — `Report`, `ExampleResult`, and `ExampleFailure`.
 *
 * @since 0.1.0
 */
export * from "./report.js"

/**
 * Lifecycle events — `EvaluationEvent` schema, constructors, and type.
 *
 * @since 0.1.0
 */
export * from "./events.js"

export {
  /**
   * Configuration for an evaluation run: module, examples, metrics, and
   * optional concurrency.
   *
   * @since 0.1.0
   * @category models
   * @see {@link run}
   * @see {@link stream}
   */
  type EvaluateOptions
} from "./runtime/kernel.js"

const appendEvent =
  (eventsRef: Ref.Ref<ReadonlyArray<EvaluationEventType>>) => (event: EvaluationEventType): Effect.Effect<void> =>
    Ref.update(eventsRef, (events) => Arr.append(events, event))

/**
 * Evaluate a module against a labeled dataset and return an aggregate report.
 *
 * Each example is scored by all provided metrics. Failures are caught and
 * collected — they do not abort the run.
 *
 * @since 0.1.0
 * @category constructors
 * @see {@link stream}
 * @see {@link Report}
 * @see {@link EvaluateOptions}
 */
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: EvaluateOptions<I, O, ME, MR>
) => evaluateKernel(options, noEvents)

/**
 * Evaluate a dataset and project lifecycle events (started, completed, failed)
 * as an Effect Stream.
 *
 * Shares the same runtime kernel as {@link run}.
 *
 * @since 0.1.0
 * @category constructors
 * @see {@link run}
 * @see {@link Report}
 * @see {@link EvaluateOptions}
 */
export const stream = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(
  options: EvaluateOptions<I, O, ME, MR>
) =>
  Stream.unwrap(
    Effect.gen(function*() {
      const eventsRef = yield* Ref.make<ReadonlyArray<EvaluationEventType>>(Arr.empty<EvaluationEventType>())

      yield* evaluateKernel(options, appendEvent(eventsRef))

      const events = yield* Ref.get(eventsRef)

      return Stream.fromIterable(events)
    })
  )
