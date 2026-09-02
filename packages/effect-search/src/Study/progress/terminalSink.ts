/**
 * Adapts formatted progress lines to stdout and stderr writers.
 *
 * @since 0.1.0
 */
import { Data, Effect, Match, Option, pipe, Predicate } from "effect"

import type { ProgressLine } from "./formatter.js"

type ProcessWriter = (chunk: string) => boolean

/** Safely extract a bound stream writer from globalThis.process via Option chains. */
const resolveProcessWriter = (stream: "stdout" | "stderr"): Option.Option<ProcessWriter> =>
  pipe(
    Option.liftPredicate(globalThis, Predicate.hasProperty("process")),
    Option.map((g) => g.process),
    Option.filter(Predicate.isRecord),
    Option.flatMap((proc) => Option.fromNullable(proc[stream])),
    Option.filter(Predicate.isRecord),
    Option.map((io) =>
      Option.fromNullable(io["write"]).pipe(
        Option.filter(Predicate.isFunction),
        Option.map((write) => (chunk: string) => write.call(io, chunk))
      )
    ),
    Option.flatten
  )

const processStdoutWriter: Option.Option<ProcessWriter> = resolveProcessWriter("stdout")

const processStderrWriter: Option.Option<ProcessWriter> = resolveProcessWriter("stderr")

const writeProcessLine = (
  write: Option.Option<ProcessWriter>,
  line: string
): Effect.Effect<void> =>
  Option.match(write, {
    onNone: () => Effect.void,
    onSome: (writer) =>
      Effect.sync(() => {
        writer(`${line}\n`)
      })
  })

const processSupportsAnsi: Effect.Effect<boolean> = Effect.sync(() =>
  pipe(
    Option.liftPredicate(globalThis, Predicate.hasProperty("process")),
    Option.map((g) => g.process),
    Option.filter(Predicate.isRecord),
    Option.map((proc) => {
      const isTTY = (key: string): boolean =>
        pipe(
          Option.fromNullable(proc[key]),
          Option.filter(Predicate.isRecord),
          Option.flatMap((io) => Option.fromNullable(io["isTTY"])),
          Option.map(Boolean),
          Option.getOrElse(() => false)
        )
      return isTTY("stdout") || isTTY("stderr")
    }),
    Option.getOrElse(() => false)
  )
)

const writeProcessStdout = (line: string): Effect.Effect<void> => writeProcessLine(processStdoutWriter, line)

const writeProcessStderr = (line: string): Effect.Effect<void> => writeProcessLine(processStderrWriter, line)

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
  /** Capability check; defaults to detecting a TTY on process stdout or stderr. */
  readonly supportsAnsi?: Effect.Effect<boolean, unknown>
  /** Stdout writer; defaults to process stdout when available. */
  readonly writeStdout?: (line: string) => Effect.Effect<void>
  /** Stderr writer; defaults to process stderr when available. */
  readonly writeStderr?: (line: string) => Effect.Effect<void>
}): TerminalSink =>
  new TerminalSink({
    supportsAnsi: Option.fromNullable(options?.supportsAnsi).pipe(Option.getOrElse(() => processSupportsAnsi)),
    writeStdout: Option.fromNullable(options?.writeStdout).pipe(Option.getOrElse(() => writeProcessStdout)),
    writeStderr: Option.fromNullable(options?.writeStderr).pipe(Option.getOrElse(() => writeProcessStderr))
  })

/**
 * Writes to process stdout and stderr when those streams are available.
 *
 * @remarks
 * The writers are captured when this module loads. Each write appends a newline
 * and ignores the process writer's backpressure result. Missing process streams
 * discard their corresponding lines.
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
