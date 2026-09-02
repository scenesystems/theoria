/**
 * Writes formatted study events to a terminal sink.
 *
 * @since 0.1.0
 */
import { Effect, Option, Stream } from "effect"

import type * as StudyEvent from "../../StudyEvent/index.js"
import { formatTerminalProgressEvent, type TerminalRenderMode } from "./formatter.js"
import { defaultTerminalSink, type TerminalSink, writeProgressLines } from "./terminalSink.js"

/**
 * Writes one study event using the render mode selected for a terminal sink.
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
 * Creates a reporter after checking whether the sink accepts ANSI text.
 *
 * @remarks
 * The capability check runs once. A typed failure from that check selects plain
 * text. Writer defects remain defects in the returned reporter.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTerminalReporter = (options?: {
  /** Destination for rendered lines; defaults to {@link defaultTerminalSink}. */
  readonly sink?: TerminalSink
}): Effect.Effect<TerminalProgressReporter> =>
  Effect.gen(function*() {
    const sink = resolveSink(options)
    const renderMode = yield* resolveRenderMode(sink)

    return (event) => writeProgressLines(sink, formatTerminalProgressEvent(event, { renderMode }))
  })

/**
 * Formats and writes one study event to a terminal sink.
 *
 * @remarks
 * ANSI support is checked for each call. Use {@link makeTerminalReporter} when
 * reporting several events through the same sink.
 *
 * @since 0.1.0
 * @category combinators
 */
export const reportTerminalProgress = (
  event: StudyEvent.StudyEvent,
  options?: {
    /** Destination for the rendered line; defaults to {@link defaultTerminalSink}. */
    readonly sink?: TerminalSink
  }
): Effect.Effect<void> =>
  makeTerminalReporter(options).pipe(
    Effect.flatMap((report) => report(event))
  )

/**
 * Writes each study event as it passes through a stream.
 *
 * @remarks
 * Event values and order are preserved. The sink's ANSI capability is checked
 * once when the resulting stream starts. Writer defects terminate stream
 * execution as defects.
 *
 * @since 0.1.0
 * @category combinators
 */
export const tapTerminalProgress = (options?: {
  /** Destination for rendered lines; defaults to {@link defaultTerminalSink}. */
  readonly sink?: TerminalSink
}) =>
<E, R>(stream: Stream.Stream<StudyEvent.StudyEvent, E, R>): Stream.Stream<StudyEvent.StudyEvent, E, R> =>
  Stream.unwrap(
    makeTerminalReporter(options).pipe(
      Effect.map((report) => stream.pipe(Stream.tap((event) => report(event))))
    )
  )
