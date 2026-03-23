/**
 * Terminal sink abstraction for writing progress lines to stdout with overwrite support.
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
    Option.flatMap((io) => Option.fromNullable(io["write"])),
    Option.filter(Predicate.isFunction),
    Option.map((write) => (chunk: string) => write(chunk))
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
 * Effectful terminal adapter boundary used by the progress reporter.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeTerminalSink } from "effect-search/Study"
 *
 * const sink = makeTerminalSink({
 *   supportsAnsi: Effect.succeed(false),
 *   writeStdout: (line) => Effect.log(`[study] ${line}`),
 *   writeStderr: (line) => Effect.logWarning(`[study] ${line}`)
 * })
 * ```
 *
 * @since 0.1.0
 * @category models
 */
export class TerminalSink extends Data.Class<{
  readonly supportsAnsi: Effect.Effect<boolean, unknown>
  readonly writeStdout: (line: string) => Effect.Effect<void>
  readonly writeStderr: (line: string) => Effect.Effect<void>
}> {}

/**
 * Construct a terminal sink from effectful writers.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeTerminalSink } from "effect-search/Study"
 *
 * const sink = makeTerminalSink({
 *   supportsAnsi: Effect.succeed(false),
 *   writeStdout: (line) => Effect.log(`[progress] ${line}`),
 *   writeStderr: (line) => Effect.logError(`[progress] ${line}`)
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTerminalSink = (options?: {
  readonly supportsAnsi?: Effect.Effect<boolean, unknown>
  readonly writeStdout?: (line: string) => Effect.Effect<void>
  readonly writeStderr?: (line: string) => Effect.Effect<void>
}): TerminalSink =>
  new TerminalSink({
    supportsAnsi: Option.fromNullable(options?.supportsAnsi).pipe(Option.getOrElse(() => processSupportsAnsi)),
    writeStdout: Option.fromNullable(options?.writeStdout).pipe(Option.getOrElse(() => writeProcessStdout)),
    writeStderr: Option.fromNullable(options?.writeStderr).pipe(Option.getOrElse(() => writeProcessStderr))
  })

/**
 * Default process-backed terminal sink.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { reportTerminalProgress, defaultTerminalSink } from "effect-search/Study"
 * import { TrialCompleted } from "effect-search/StudyEvent"
 *
 * Effect.gen(function*() {
 *   yield* reportTerminalProgress(
 *     TrialCompleted({ trialNumber: 1, value: 0.42 }),
 *     { sink: defaultTerminalSink }
 *   )
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultTerminalSink: TerminalSink = makeTerminalSink()

/**
 * Flush pre-formatted progress lines through a sink.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { formatTerminalProgressEvent, writeProgressLines, defaultTerminalSink } from "effect-search/Study"
 * import { TrialCompleted } from "effect-search/StudyEvent"
 *
 * const lines = formatTerminalProgressEvent(TrialCompleted({ trialNumber: 1, value: 0.5 }), { renderMode: "plain" })
 * Effect.gen(function*() {
 *   yield* writeProgressLines(defaultTerminalSink, lines)
 * })
 * ```
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
