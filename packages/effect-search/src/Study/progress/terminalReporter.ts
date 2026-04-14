/**
 * Terminal progress reporter that pipes study event streams to formatted console output.
 *
 * @since 0.1.0
 */
import { Effect, Option, Stream } from "effect"

import type * as StudyEvent from "../../StudyEvent/index.js"
import { ProgressLine, type TerminalRenderMode } from "./formatter.js"
import { defaultTerminalSink, type TerminalSink, writeProgressLines } from "./terminalSink.js"

/**
 * Effectful reporter callback used by stream combinators and manual pipelines.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { TerminalReporter } from "effect-search/Study"
 * import type { StudyEvent } from "effect-search/StudyEvent"
 *
 * declare const event: StudyEvent
 * Effect.gen(function*() {
 *   const report = yield* TerminalReporter.allocate()
 *   yield* report(event)
 * })
 * ```
 *
 * @since 0.1.0
 * @category type-level
 */
export type TerminalProgressReporter = (event: StudyEvent.StudyEvent) => Effect.Effect<void>

const resolveSink = (options?: { readonly sink?: TerminalSink }): TerminalSink =>
  Option.fromNullable(options?.sink).pipe(Option.getOrElse(() => defaultTerminalSink))

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
 * Terminal reporter authority that allocates a reusable effectful reporter
 * callback from a sink once and then reuses the resolved render mode for every
 * event in the stream.
 *
 * @example
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { TerminalReporter, TerminalSink } from "effect-search/Study"
 * import type { StudyEvent } from "effect-search/StudyEvent"
 *
 * declare const stream: Stream.Stream<StudyEvent>
 * const sink = TerminalSink.make()
 * Effect.gen(function*() {
 *   const report = yield* TerminalReporter.allocate({ sink })
 *   yield* Stream.runForEach(stream, report)
 * })
 * ```
 *
 * @since 0.3.0
 * @category constructors
 */
export class TerminalReporter {
  private constructor() {}

  /**
   * Allocates a reporter once so render-mode detection does not repeat for
   * every downstream study event.
   *
   * @since 0.3.0
   * @category constructors
   */
  static allocate(options?: { readonly sink?: TerminalSink }): Effect.Effect<TerminalProgressReporter> {
    return Effect.gen(function*() {
      const sink = resolveSink(options)
      const renderMode = yield* resolveRenderMode(sink)

      return (event) => writeProgressLines(sink, ProgressLine.projectEvent(event, { renderMode }))
    })
  }

  /**
   * Render and emit a single study event to a terminal sink.
   *
   * Useful for one-shot reporting in manual ask/tell orchestration or adapter
   * boundaries that already hold a concrete `StudyEvent` value.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { TerminalReporter, TerminalSink } from "effect-search/Study"
   * import { StudyCompleted } from "effect-search/StudyEvent"
   *
   * const sink = TerminalSink.make()
   * Effect.gen(function*() {
   *   yield* TerminalReporter.report(
   *     StudyCompleted.make({ completionReason: "budgetExhausted" }),
   *     { sink }
   *   )
   * })
   * ```
   *
   * @since 0.3.0
   * @category combinators
   */
  static report(
    event: StudyEvent.StudyEvent,
    options?: { readonly sink?: TerminalSink }
  ): Effect.Effect<void> {
    return TerminalReporter.allocate(options).pipe(Effect.flatMap((report) => report(event)))
  }

  /**
   * Stream combinator that taps study events into the terminal reporter without
   * mutating optimization behavior.
   *
   * @example
   * ```ts
   * import { Stream } from "effect"
   * import { TerminalReporter, TerminalSink } from "effect-search/Study"
   * import type { StudyEvent } from "effect-search/StudyEvent"
   *
   * const sink = TerminalSink.make()
   * const tap = <E, R>(stream: Stream.Stream<StudyEvent, E, R>) =>
   *   stream.pipe(TerminalReporter.tap({ sink }))
   * ```
   *
   * @since 0.3.0
   * @category combinators
   */
  static tap(
    options?: { readonly sink?: TerminalSink }
  ): <E, R>(stream: Stream.Stream<StudyEvent.StudyEvent, E, R>) => Stream.Stream<StudyEvent.StudyEvent, E, R> {
    return <E, R>(stream: Stream.Stream<StudyEvent.StudyEvent, E, R>): Stream.Stream<StudyEvent.StudyEvent, E, R> =>
      Stream.unwrap(
        TerminalReporter.allocate(options).pipe(
          Effect.map((report) => stream.pipe(Stream.tap((event) => report(event))))
        )
      )
  }
}
