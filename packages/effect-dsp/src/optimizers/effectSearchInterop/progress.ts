/**
 * Projects effect-search study events and formatted terminal progress.
 *
 * @since 0.1.0
 */
import { Study } from "@scenesystems/effect-search"
import type * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import { Effect, Option, Stream } from "effect"

import {
  type EffectSearchInteropEvent,
  type EffectSearchInteropHandle,
  type EffectSearchProgressLine
} from "./model.js"

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
): Stream.Stream<EffectSearchInteropEvent> => Study.events(handle)

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
    readonly renderMode?: Study.TerminalRenderMode
  }
): Stream.Stream<EffectSearchInteropEvent, E, R> => {
  const renderMode = Option.fromNullable(options?.renderMode)

  return Study.events(handle).pipe(
    Stream.tap((event) =>
      Effect.forEach(
        Option.match(renderMode, {
          onNone: () => Study.formatTerminalProgressEvent(event),
          onSome: (mode) => Study.formatTerminalProgressEvent(event, { renderMode: mode })
        }),
        (line) => onProgress(line),
        { discard: true }
      )
    )
  )
}
