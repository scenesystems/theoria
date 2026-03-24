/**
 * Terminal progress line formatting for study events with ANSI color support.
 *
 * @since 0.1.0
 */
import { Data, Match, Schema } from "effect"

import type { ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import type * as StudyEvent from "../../StudyEvent/index.js"

const ANSI_RESET = "\u001b[0m"
const ANSI_BLUE = "\u001b[36m"
const ANSI_GREEN = "\u001b[32m"
const ANSI_YELLOW = "\u001b[33m"
const ANSI_RED = "\u001b[31m"

/**
 * @since 0.1.0
 * @category schemas
 * @example
 * ```ts
 * import { Schema } from "effect"
 * import { TerminalRenderModeSchema } from "effect-search/Study"
 *
 * const mode = Schema.decodeSync(TerminalRenderModeSchema)("plain")
 * ```
 */
export const TerminalRenderModeSchema = Schema.Literal("plain", "tty")

/**
 * @since 0.1.0
 * @category type-level
 */
export type TerminalRenderMode = Schema.Schema.Type<typeof TerminalRenderModeSchema>

/**
 * Single rendered terminal line produced by the progress formatter.
 *
 * @example
 * ```ts
 * import { ProgressLine } from "effect-search/Study"
 *
 * const line = new ProgressLine({ channel: "stdout", text: "trial#1 started" })
 * ```
 *
 * @since 0.1.0
 * @category models
 */
export class ProgressLine extends Data.Class<{
  readonly channel: "stdout" | "stderr"
  readonly text: string
}> {}

const objectiveValueText = (value: ObjectiveValue): string =>
  Match.value(value).pipe(
    Match.when(Match.number, (entry) => `${entry}`),
    Match.orElse((entries) => `[${entries.join(", ")}]`)
  )

const withColor = (renderMode: TerminalRenderMode, colorCode: string, text: string): string =>
  Match.value(renderMode).pipe(
    Match.when("tty", () => `${colorCode}${text}${ANSI_RESET}`),
    Match.orElse(() => text)
  )

const stdout = (text: string): ProgressLine => new ProgressLine({ channel: "stdout", text })

const stderr = (text: string): ProgressLine => new ProgressLine({ channel: "stderr", text })

const resolveRenderMode = (
  options?: {
    readonly renderMode?: TerminalRenderMode
  }
): TerminalRenderMode =>
  options?.renderMode === "tty"
    ? "tty"
    : "plain"

const formatEvent = (event: StudyEvent.StudyEvent, renderMode: TerminalRenderMode): ProgressLine =>
  Match.value(event).pipe(
    Match.tag(
      "TrialStarted",
      ({ trialNumber }) => stdout(withColor(renderMode, ANSI_BLUE, `trial#${trialNumber} started`))
    ),
    Match.tag(
      "TrialReported",
      ({ trialNumber, step, value, decision }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_BLUE,
            `trial#${trialNumber} report step=${step} value=${value} decision=${decision._tag}`
          )
        )
    ),
    Match.tag(
      "TrialCompleted",
      ({ trialNumber, value }) =>
        stdout(withColor(renderMode, ANSI_GREEN, `trial#${trialNumber} completed value=${objectiveValueText(value)}`))
    ),
    Match.tag(
      "TrialCosted",
      ({ trialNumber, cost, cumulativeCost }) =>
        stdout(withColor(renderMode, ANSI_BLUE, `trial#${trialNumber} cost=${cost} cumulative=${cumulativeCost}`))
    ),
    Match.tag(
      "TrialPruned",
      ({ trialNumber, step, reason, policy }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_YELLOW,
            `trial#${trialNumber} pruned step=${step} policy=${policy} reason=${reason}`
          )
        )
    ),
    Match.tag(
      "TrialRetried",
      ({ trialNumber, attempt, error }) =>
        stderr(
          withColor(renderMode, ANSI_YELLOW, `trial#${trialNumber} retried attempt=${attempt} error=${error._tag}`)
        )
    ),
    Match.tag(
      "TrialCancelled",
      ({ trialNumber, reason }) =>
        stderr(withColor(renderMode, ANSI_YELLOW, `trial#${trialNumber} cancelled reason=${reason}`))
    ),
    Match.tag(
      "TrialFailed",
      ({ trialNumber, error }) =>
        stderr(
          withColor(renderMode, ANSI_RED, `trial#${trialNumber} failed error=${error._tag} message=${error.message}`)
        )
    ),
    Match.tag(
      "BestUpdated",
      ({ trialNumber, value }) =>
        stdout(withColor(renderMode, ANSI_GREEN, `best-updated trial#${trialNumber} value=${value}`))
    ),
    Match.tag(
      "StudyStopRequested",
      ({ mode, reason, requestedByTrialNumber }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_YELLOW,
            `study stop-request mode=${mode} reason=${reason} requested-by=${requestedByTrialNumber}`
          )
        )
    ),
    Match.tag(
      "BracketStarted",
      ({ bracketIndex, configs, minResource }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_BLUE,
            `bracket#${bracketIndex} started configs=${configs} min-resource=${minResource}`
          )
        )
    ),
    Match.tag(
      "RoundStarted",
      ({ bracketIndex, roundIndex, nConfigs, resource }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_BLUE,
            `bracket#${bracketIndex} round#${roundIndex} started n-configs=${nConfigs} resource=${resource}`
          )
        )
    ),
    Match.tag(
      "RoundCompleted",
      ({ bracketIndex, roundIndex, nConfigs, resource, completed }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_BLUE,
            `bracket#${bracketIndex} round#${roundIndex} completed n-configs=${nConfigs} resource=${resource} finished=${completed}`
          )
        )
    ),
    Match.tag(
      "BracketCompleted",
      ({ bracketIndex, rounds, bestValue }) =>
        stdout(
          withColor(
            renderMode,
            ANSI_GREEN,
            `bracket#${bracketIndex} completed rounds=${rounds} best=${bestValue ?? "none"}`
          )
        )
    ),
    Match.tag(
      "StudyCompleted",
      ({ completionReason }) => stdout(withColor(renderMode, ANSI_GREEN, `study completed reason=${completionReason}`))
    ),
    Match.exhaustive
  )

/**
 * Deterministically render a `StudyEvent` into terminal lines.
 *
 * This function is intentionally pure; it performs no IO and can be reused by
 * alternate sinks (JSON logger, dashboard bridge, structured telemetry).
 *
 * @example
 * ```ts
 * import { formatTerminalProgressEvent } from "effect-search/Study"
 * import { TrialCompleted } from "effect-search/StudyEvent"
 *
 * const lines = formatTerminalProgressEvent(
 *   TrialCompleted({ trialNumber: 1, value: 0.42 }),
 *   { renderMode: "plain" }
 * )
 * ```
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatTerminalProgressEvent = (
  event: StudyEvent.StudyEvent,
  options?: {
    readonly renderMode?: TerminalRenderMode
  }
): ReadonlyArray<ProgressLine> => [formatEvent(event, resolveRenderMode(options))]
