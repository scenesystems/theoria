/**
 * Runs modules against labeled examples and aggregates metric scores.
 *
 * @remarks
 * Each example becomes a report entry instead of failing the whole evaluation
 * for an expected module, decode, or metric error. Use `run` for the report and
 * `stream` for buffered lifecycle events after evaluation completes.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Ref, Stream } from "effect"
import type { Schema } from "effect"
import type { EvaluationEventType } from "./events.js"
import { evaluateKernel, type EvaluateOptions, noEvents } from "./runtime/kernel.js"

export * from "./report.js"

export * from "./events.js"

export { type EvaluateOptions } from "./runtime/kernel.js"

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
 * Defects and interruption remain in the Effect cause and are not converted to
 * example failures.
 *
 * @param options - Module, labeled examples, metrics, and example concurrency.
 * @returns A report containing every input position and aggregate scores.
 * @typeParam I - Input fields accepted by the evaluated module.
 * @typeParam O - Output fields returned by the evaluated module.
 * @typeParam ME - Expected failure from the configured metrics.
 * @typeParam MR - Services required by the configured metrics.
 *
 * @since 0.1.0
 * @category operations
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
 * Expected per-example failures become `ExampleFailed` values. Defects and
 * interruption fail the Stream. The module and metrics retain their service
 * requirements.
 *
 * @param options - Module, labeled examples, metrics, and example concurrency.
 * @returns A finite Stream backed by the events buffered during evaluation.
 * @typeParam I - Input fields accepted by the evaluated module.
 * @typeParam O - Output fields returned by the evaluated module.
 * @typeParam ME - Expected failure from the configured metrics.
 * @typeParam MR - Services required by the configured metrics.
 *
 * @since 0.1.0
 * @category operations
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
