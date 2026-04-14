/**
 * Event stream and progress line composition for effect-search ↔ effect-dsp
 * interop.
 *
 * @since 0.1.0
 */
import { Effect, Option, Stream } from "effect"
import { Study } from "effect-search"
import type * as SearchSpace from "effect-search/SearchSpace"

import {
  type EffectSearchInteropEvent,
  type EffectSearchInteropHandle,
  type EffectSearchProgressLine
} from "./model.js"

/**
 * Stream study lifecycle events from an ask/tell handle without progress
 * formatting.
 *
 * @see {@link eventsWithProgress} for events with terminal progress lines
 * @since 0.1.0
 * @category combinators
 */
export const events = <Space extends SearchSpace.SearchSpace>(
  handle: EffectSearchInteropHandle<Space>
): Stream.Stream<EffectSearchInteropEvent> => Study.events(handle)

/**
 * Stream study lifecycle events while tapping each event through a formatted
 * progress-line callback. Useful for rendering terminal progress during
 * optimization.
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
          onNone: () => Study.ProgressLine.projectEvent(event),
          onSome: (mode) => Study.ProgressLine.projectEvent(event, { renderMode: mode })
        }),
        (line) => onProgress(line),
        { discard: true }
      )
    )
  )
}
