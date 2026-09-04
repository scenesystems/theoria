/**
 * Adapts formatted progress lines to stdout and stderr writers.
 *
 * @since 0.1.0
 */
import { Console, Data, Effect, Match, Option } from "effect"

import type { ProgressLine } from "./formatter.js"

/**
 * Defines terminal capability detection and line writers for progress output.
 *
 * @since 0.1.0
 * @category models
 */
export class TerminalSink extends Data.Class<{
  /** Determines whether reporters should format text with ANSI color sequences. */
  readonly supportsAnsi: Effect.Effect<boolean, unknown>
  /** Receives stdout text without a trailing newline. */
  readonly writeStdout: (line: string) => Effect.Effect<void>
  /** Receives stderr text without a trailing newline. */
  readonly writeStderr: (line: string) => Effect.Effect<void>
}> {}

/**
 * Creates a terminal sink from caller-owned writers and capability detection.
 *
 * @example
 * ```ts
 * import { Array, Effect, Option, Ref } from "effect"
 * import { makeTerminalSink, reportTerminalProgress } from "@scenesystems/effect-search/Study"
 * import { TrialFailed } from "@scenesystems/effect-search/StudyEvent"
 * import { TrialError } from "@scenesystems/effect-search/Errors"
 *
 * export const program = Effect.gen(function*() {
 *   const stderr = yield* Ref.make<ReadonlyArray<string>>([])
 *   const sink = makeTerminalSink({
 *     supportsAnsi: Effect.succeed(false),
 *     writeStderr: (line) => Ref.update(stderr, Array.append(line))
 *   })
 *
 *   yield* reportTerminalProgress(
 *     TrialFailed({
 *       trialNumber: 3,
 *       error: new TrialError({ trialNumber: 3, message: "objective failed", cause: "timeout" })
 *     }),
 *     { sink }
 *   )
 *
 *   const lines = yield* Ref.get(stderr)
 *   return yield* Option.match(Array.head(lines), {
 *     onNone: () => Effect.fail("MissingStderrLine"),
 *     onSome: (line) =>
 *       Effect.succeed(line).pipe(
 *         Effect.filterOrFail(
 *           (text) => text === "trial#3 failed error=effect-search/TrialError message=objective failed",
 *           () => "UnexpectedStderrLine"
 *         )
 *       )
 *   })
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTerminalSink = (options?: {
  /** Capability check; defaults to plain text, since only the caller knows whether its output is a colour terminal. */
  readonly supportsAnsi?: Effect.Effect<boolean, unknown>
  /** Stdout writer; defaults to the fiber's `Console` service. */
  readonly writeStdout?: (line: string) => Effect.Effect<void>
  /** Stderr writer; defaults to the fiber's `Console` service. */
  readonly writeStderr?: (line: string) => Effect.Effect<void>
}): TerminalSink =>
  new TerminalSink({
    supportsAnsi: Option.fromNullable(options?.supportsAnsi).pipe(Option.getOrElse(() => Effect.succeed(false))),
    writeStdout: Option.fromNullable(options?.writeStdout).pipe(Option.getOrElse(() => Console.log)),
    writeStderr: Option.fromNullable(options?.writeStderr).pipe(Option.getOrElse(() => Console.error))
  })

/**
 * Writes through Effect's `Console` service: stdout lines with `Console.log`,
 * stderr lines with `Console.error`, and no ANSI colour.
 *
 * @remarks
 * The `Console` service is resolved when each line is written, so a program
 * redirects the sink with `Console.withConsole` or `Console.setConsole` the
 * same way it redirects any other console output. Callers that know their
 * output is a colour terminal pass `supportsAnsi` to {@link makeTerminalSink}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultTerminalSink: TerminalSink = makeTerminalSink()

/**
 * Writes formatted lines sequentially in array order.
 *
 * @since 0.1.0
 * @category combinators
 */
export const writeProgressLines = (
  sink: TerminalSink,
  lines: ReadonlyArray<ProgressLine>
): Effect.Effect<void> =>
  Effect.forEach(
    lines,
    (line) =>
      Match.value(line.channel).pipe(
        Match.when("stdout", () => sink.writeStdout(line.text)),
        Match.when("stderr", () => sink.writeStderr(line.text)),
        Match.exhaustive
      ),
    { discard: true }
  )
