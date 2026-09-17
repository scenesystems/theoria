/**
 * Projects effect-search study events and formatted terminal progress.
 *
 * @since 0.1.0
 */
import * as Optimization from "@scenesystems/effect-search/Optimization"
import type * as OptimizationEvent from "@scenesystems/effect-search/OptimizationEvent"
import * as Progress from "@scenesystems/effect-search/Progress"
import type * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import { Effect, Option, Stream } from "effect"

import { type EffectSearchInteropHandle, type EffectSearchProgressLine } from "./model.js"

/**
 * Consumes events emitted after an ask/tell handle opened.
 *
 * @remarks
 * Events are not replayed. Concurrent consumers share one queue and divide
 * events. The stream completes when the handle is cancelled or exhausts its
 * trial budget or search space.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 *
 * @see {@link eventsWithProgress} for events with terminal progress lines
 * @since 0.1.0
 * @category combinators
 */
export const events = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Stream.Stream<OptimizationEvent.OptimizationEvent> => Optimization.events(handle)

/**
 * Runs a progress callback for each terminal line produced from study events.
 *
 * @remarks
 * Events with multiple formatted lines invoke the callback once per line before
 * the event continues downstream. Callback failures and requirements are added
 * to the stream. Omitted `renderMode` uses effect-search's default formatter.
 *
 * @typeParam Space - Search-space schema retained by the study handle.
 * @typeParam E - Expected failure from the progress callback.
 * @typeParam R - Services required by the progress callback.
 *
 * @see {@link events} for the raw event stream without progress
 * @since 0.1.0
 * @category combinators
 */
export const eventsWithProgress = <Space extends SearchSpace.SearchSpace, E, R>(
  handle: EffectSearchInteropHandle<Space>,
  onProgress: (line: EffectSearchProgressLine) => Effect.Effect<void, E, R>,
  options?: {
    readonly renderMode?: Progress.RenderMode
  }
): Stream.Stream<OptimizationEvent.OptimizationEvent, E, R> => {
  const renderMode = Option.fromNullable(options?.renderMode)

  return Optimization.events(handle).pipe(
    Stream.tap((event) =>
      Effect.forEach(
        Option.match(renderMode, {
          onNone: () => Progress.format(event),
          onSome: (mode) => Progress.format(event, mode)
        }),
        (line) => onProgress(line),
        { discard: true }
      )
    )
  )
}
