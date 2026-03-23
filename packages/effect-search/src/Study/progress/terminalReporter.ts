/**
 * Terminal progress reporter that pipes study event streams to formatted console output.
 *
 * @since 0.1.0
 */
import { Effect, Option, Stream } from "effect"

import type * as StudyEvent from "../../StudyEvent/index.js"
import { formatTerminalProgressEvent, type TerminalRenderMode } from "./formatter.js"
import { defaultTerminalSink, type TerminalSink, writeProgressLines } from "./terminalSink.js"

/**
 * Effectful reporter callback used by stream combinators and manual pipelines.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeTerminalReporter } from "effect-search/Study"
 * import type { StudyEvent } from "effect-search/StudyEvent"
 *
 * declare const event: StudyEvent
 * Effect.gen(function*() {
 *   const report = yield* makeTerminalReporter()
 *   yield* report(event)
 * })
 * ```
 *
 * @since 0.1.0
 * @category type-level
 */
export type TerminalProgressReporter = (event: StudyEvent.StudyEvent) => Effect.Effect<void>

const resolveSink = (
  options?: {
    readonly sink?: TerminalSink
  }
): TerminalSink => Option.fromNullable(options?.sink).pipe(Option.getOrElse(() => defaultTerminalSink))

const renderModeFromAnsiSupport = (supportsAnsi: boolean): TerminalRenderMode =>
  supportsAnsi
    ? "tty"
    : "plain"

const resolveRenderMode = (sink: TerminalSink): Effect.Effect<TerminalRenderMode> =>
  sink.supportsAnsi.pipe(
    Effect.map(renderModeFromAnsiSupport),
    Effect.catchAll(() => Effect.succeed(renderModeFromAnsiSupport(false)))
  )

/**
 * Create a terminal reporter that resolves sink capabilities once and reuses
 * them for every event in the stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { makeTerminalReporter, makeTerminalSink } from "effect-search/Study"
 * import type { StudyEvent } from "effect-search/StudyEvent"
 *
 * declare const stream: Stream.Stream<StudyEvent>
 * const sink = makeTerminalSink()
 * Effect.gen(function*() {
 *   const report = yield* makeTerminalReporter({ sink })
 *   yield* Stream.runForEach(stream, report)
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTerminalReporter = (options?: {
  readonly sink?: TerminalSink
}): Effect.Effect<TerminalProgressReporter> =>
  Effect.gen(function*() {
    const sink = resolveSink(options)
    const renderMode = yield* resolveRenderMode(sink)

    return (event) => writeProgressLines(sink, formatTerminalProgressEvent(event, { renderMode }))
  })

/**
 * Render and emit a single study event to a terminal sink.
 *
 * Useful for one-shot reporting in manual ask/tell orchestration or adapter
 * boundaries that already hold a concrete `StudyEvent` value.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { reportTerminalProgress, makeTerminalSink } from "effect-search/Study"
 * import { StudyCompleted } from "effect-search/StudyEvent"
 *
 * const sink = makeTerminalSink()
 * Effect.gen(function*() {
 *   yield* reportTerminalProgress(
 *     StudyCompleted({ completionReason: "budgetExhausted" }),
 *     { sink }
 *   )
 * })
 * ```
 *
 * @since 0.1.0
 * @category combinators
 */
export const reportTerminalProgress = (
  event: StudyEvent.StudyEvent,
  options?: {
    readonly sink?: TerminalSink
  }
): Effect.Effect<void> =>
  makeTerminalReporter(options).pipe(
    Effect.flatMap((report) => report(event))
  )

/**
 * Stream combinator that taps study events into the terminal reporter without
 * mutating optimization behavior.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
 * import { tapTerminalProgress, makeTerminalSink } from "effect-search/Study"
 * import type { StudyEvent } from "effect-search/StudyEvent"
 *
 * const sink = makeTerminalSink()
 * const tap = <E, R>(stream: Stream.Stream<StudyEvent, E, R>) =>
 *   stream.pipe(tapTerminalProgress({ sink }))
 * ```
 *
 * @since 0.1.0
 * @category combinators
 */
export const tapTerminalProgress = (options?: {
  readonly sink?: TerminalSink
}) =>
<E, R>(stream: Stream.Stream<StudyEvent.StudyEvent, E, R>): Stream.Stream<StudyEvent.StudyEvent, E, R> =>
  Stream.unwrap(
    makeTerminalReporter(options).pipe(
      Effect.map((report) => stream.pipe(Stream.tap((event) => report(event))))
    )
  )
