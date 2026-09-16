/**
 * Terminal study progress formatting and reporting.
 *
 * @since 0.7.0
 * @module
 */
import { Array as Arr, Console, Data, Effect, Match, Option, Schema, Stream, String as Str } from "effect"

import { type Value, Vector } from "./Objective.js"
import type * as StudyEvent from "./StudyEvent.js"

const ANSI_RESET = "\u001b[0m"
const ANSI_BLUE = "\u001b[36m"
const ANSI_GREEN = "\u001b[32m"
const ANSI_YELLOW = "\u001b[33m"
const ANSI_RED = "\u001b[31m"

/** Plain or ANSI terminal rendering. @since 0.7.0 @category schemas */
export const RenderMode = Schema.Literal("plain", "tty")
/** @since 0.7.0 @category models */
export type RenderMode = typeof RenderMode.Type

/** One routed terminal line. @since 0.7.0 @category schemas */
export class Line extends Schema.Class<Line>("effect-search/Progress/Line")({
  channel: Schema.Literal("stdout", "stderr"),
  text: Schema.String
}) {}

const Lines = Schema.Array(Line)
const numberText = Schema.encodeSync(Schema.NumberFromString)

const valueText = (value: Value): string =>
  Match.value(value).pipe(
    Match.when(Match.number, numberText),
    Match.when(Schema.is(Vector), (entries) => `[${Arr.join(Arr.map(entries, (entry) => numberText(entry)), ", ")}]`),
    Match.exhaustive
  )

/** Terminal capability and writers. @since 0.7.0 @category models */
export class Sink extends Data.Class<{
  readonly supportsAnsi: Effect.Effect<boolean>
  readonly writeStdout: (line: string) => Effect.Effect<void>
  readonly writeStderr: (line: string) => Effect.Effect<void>
}> {}

/** Sink construction options. @since 0.7.0 @category models */
export class SinkOptions extends Data.Class<{
  readonly supportsAnsi?: Effect.Effect<boolean>
  readonly writeStdout?: (line: string) => Effect.Effect<void>
  readonly writeStderr?: (line: string) => Effect.Effect<void>
}> {}

/** Creates a terminal sink, defaulting to the fiber Console. @since 0.7.0 @category constructors */
export const makeSink = (options: SinkOptions = new SinkOptions({})): Sink =>
  new Sink({
    supportsAnsi: Option.fromNullable(options.supportsAnsi).pipe(Option.getOrElse(() => Effect.succeed(false))),
    writeStdout: Option.fromNullable(options.writeStdout).pipe(Option.getOrElse(() => Console.log)),
    writeStderr: Option.fromNullable(options.writeStderr).pipe(Option.getOrElse(() => Console.error))
  })

/** Default plain-text Console sink. @since 0.7.0 @category constants */
export const defaultSink = makeSink()

const color = (mode: RenderMode, code: string, text: string): string =>
  Match.value(mode).pipe(
    Match.when("tty", () => Str.concat(code, Str.concat(text, ANSI_RESET))),
    Match.orElse(() => text)
  )

const stdout = (text: string): Line => new Line({ channel: "stdout", text })
const stderr = (text: string): Line => new Line({ channel: "stderr", text })

const formatEvent = (event: StudyEvent.Event, mode: RenderMode): Line =>
  Match.value(event).pipe(
    Match.tag("TrialStarted", ({ trialNumber }) => stdout(color(mode, ANSI_BLUE, `trial#${trialNumber} started`))),
    Match.tag("TrialReported", ({ trialNumber, step, value, decision }) =>
      stdout(
        color(mode, ANSI_BLUE, `trial#${trialNumber} report step=${step} value=${value} decision=${decision._tag}`)
      )),
    Match.tag("TrialCompleted", ({ trialNumber, value }) =>
      stdout(
        color(
          mode,
          ANSI_GREEN,
          `trial#${trialNumber} completed value=${valueText(value)}`
        )
      )),
    Match.tag("TrialCosted", ({ trialNumber, cost, cumulativeCost }) =>
      stdout(color(mode, ANSI_BLUE, `trial#${trialNumber} cost=${cost} cumulative=${cumulativeCost}`))),
    Match.tag("TrialPruned", ({ trialNumber, step, reason, policy }) =>
      stdout(color(mode, ANSI_YELLOW, `trial#${trialNumber} pruned step=${step} policy=${policy} reason=${reason}`))),
    Match.tag("TrialRetried", ({ trialNumber, attempt, error }) =>
      stderr(color(mode, ANSI_YELLOW, `trial#${trialNumber} retried attempt=${attempt} error=${error._tag}`))),
    Match.tag("TrialCancelled", ({ trialNumber, reason }) =>
      stderr(color(mode, ANSI_YELLOW, `trial#${trialNumber} cancelled reason=${reason}`))),
    Match.tag("TrialFailed", ({ trialNumber, error }) =>
      stderr(color(mode, ANSI_RED, `trial#${trialNumber} failed error=${error._tag} message=${error.message}`))),
    Match.tag("BestUpdated", ({ trialNumber, value }) =>
      stdout(color(mode, ANSI_GREEN, `best-updated trial#${trialNumber} value=${value}`))),
    Match.tag("StopRequested", ({ mode: stopMode, reason, requestedByTrialNumber }) =>
      stdout(
        color(
          mode,
          ANSI_YELLOW,
          `study stop-request mode=${stopMode} reason=${reason} requested-by=${requestedByTrialNumber}`
        )
      )),
    Match.tag("BracketStarted", ({ bracketIndex, configs, minResource }) =>
      stdout(color(mode, ANSI_BLUE, `bracket#${bracketIndex} started configs=${configs} min-resource=${minResource}`))),
    Match.tag("RoundStarted", ({ bracketIndex, roundIndex, nConfigs, resource }) =>
      stdout(
        color(
          mode,
          ANSI_BLUE,
          `bracket#${bracketIndex} round#${roundIndex} started n-configs=${nConfigs} resource=${resource}`
        )
      )),
    Match.tag("RoundCompleted", ({ bracketIndex, roundIndex, nConfigs, resource, completed }) =>
      stdout(
        color(
          mode,
          ANSI_BLUE,
          `bracket#${bracketIndex} round#${roundIndex} completed n-configs=${nConfigs} resource=${resource} finished=${completed}`
        )
      )),
    Match.tag("BracketCompleted", ({ bracketIndex, rounds, bestValue }) =>
      stdout(
        color(
          mode,
          ANSI_GREEN,
          `bracket#${bracketIndex} completed rounds=${rounds} best=${
            Option.fromNullable(bestValue).pipe(Option.match({
              onNone: () => "none",
              onSome: numberText
            }))
          }`
        )
      )),
    Match.tag("Completed", ({ completionReason }) =>
      stdout(color(mode, ANSI_GREEN, `study completed reason=${completionReason}`))),
    Match.exhaustive
  )

/** Formats one event into routed lines. @since 0.7.0 @category formatters */
export const format = (event: StudyEvent.Event, mode: RenderMode = "plain"): typeof Lines.Type =>
  Arr.of(formatEvent(event, mode))

/** Writes lines sequentially. @since 0.7.0 @category combinators */
export const write = (sink: Sink, lines: Iterable<Line>): Effect.Effect<void> =>
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

/** Creates a reporter after probing ANSI support once. @since 0.7.0 @category constructors */
export const make = (sink: Sink = defaultSink) =>
  sink.supportsAnsi.pipe(
    Effect.map((supportsAnsi) =>
      Match.value(supportsAnsi).pipe(
        Match.when(true, () => (event: StudyEvent.Event) => write(sink, format(event, "tty"))),
        Match.orElse(() => (event: StudyEvent.Event) => write(sink, format(event, "plain")))
      )
    )
  )

/** Reports one event. @since 0.7.0 @category combinators */
export const report = (event: StudyEvent.Event, sink: Sink = defaultSink): Effect.Effect<void> =>
  make(sink).pipe(Effect.flatMap((emit) => emit(event)))

/** Reports events without changing stream values or order. @since 0.7.0 @category combinators */
export const tap =
  (sink: Sink = defaultSink) =>
  <E, R>(stream: Stream.Stream<StudyEvent.Event, E, R>): Stream.Stream<StudyEvent.Event, E, R> =>
    Stream.unwrap(make(sink).pipe(Effect.map((emit) => Stream.tap(stream, emit))))
