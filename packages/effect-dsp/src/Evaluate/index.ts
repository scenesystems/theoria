/**
 * Evaluate modules against labeled examples.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Ref, Stream } from "effect"
import type { Schema } from "effect"
import type { EvaluationEventType } from "./events.js"
import { evaluateKernel, type EvaluateOptions, noEvents } from "./runtime/kernel.js"

/**
 * Evaluation report models.
 *
 * @since 0.1.0
 */
export * from "./report.js"

/**
 * Evaluation lifecycle events.
 *
 * @since 0.1.0
 */
export * from "./events.js"

export {
  /**
   * Inputs for evaluating labeled examples against a module.
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
 * Evaluates a module against labeled examples and returns their report.
 *
 * @remarks
 * Examples run with the requested concurrency, while returned results retain
 * input order. Metrics run sequentially in name-sorted order. A module,
 * decoding, or metric failure is stored on that example and does not fail the
 * returned Effect. Overall metric scores average successful examples only;
 * an empty successful set scores `0`.
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
 * Evaluates labeled examples and returns the buffered lifecycle events.
 *
 * @remarks
 * Evaluation completes before the Stream emits. With concurrent examples,
 * start and terminal events follow execution timing; `EvaluationCompleted` is
 * last. The report itself is not emitted.
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
