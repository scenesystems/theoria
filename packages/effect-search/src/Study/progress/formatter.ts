/**
 * Terminal progress line formatting for study events with ANSI color support.
 *
 * @since 0.1.0
 */
import { Data, Match, Schema } from "effect"

import type { ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import type * as StudyEvent from "../../StudyEvent/index.js"

/**
 * Decomposition rationale: terminal render-mode normalization and event-to-line
 * projection remain co-located so `ProgressLine.projectEvent` stays one
 * auditable pure ownership boundary.
 *
 * Follow-up: extract ANSI palette/render helpers into
 * `Study/progress/renderMode.ts` and split bracket-versus-trial event
 * projection into focused modules if another projection noun needs to reuse the
 * same render semantics.
 */

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
 * const line = ProgressLine.make({ channel: "stdout", text: "trial#1 started" })
 * ```
 *
 * @since 0.1.0
 * @category models
 */
export class ProgressLine extends Data.Class<{
  readonly channel: "stdout" | "stderr"
  readonly text: string
}> {
  /**
   * Construct a stable progress-line value from trusted fields.
   *
   * @since 0.3.0
   * @category constructors
   */
  static make(options: { readonly channel: "stdout" | "stderr"; readonly text: string }): ProgressLine {
    return new ProgressLine(options)
  }

  /**
   * Project a `StudyEvent` into deterministic terminal lines.
   *
   * This method is intentionally pure; it performs no IO and can be reused by
   * alternate sinks (JSON logger, dashboard bridge, structured telemetry).
   *
   * @example
   * ```ts
   * import { ProgressLine } from "effect-search/Study"
   * import { TrialCompleted } from "effect-search/StudyEvent"
   *
   * const lines = ProgressLine.projectEvent(
   *   TrialCompleted.make({ trialNumber: 1, value: 0.42 }),
   *   { renderMode: "plain" }
   * )
   * ```
   *
   * @since 0.3.0
   * @category formatters
   */
  static projectEvent(
    event: StudyEvent.StudyEvent,
    options?: {
      readonly renderMode?: TerminalRenderMode
    }
  ): ReadonlyArray<ProgressLine> {
    return [projectLine(event, resolveRenderMode(options))]
  }

  /**
   * Constructs a stdout progress line for normal study updates.
   *
   * @since 0.3.0
   * @category constructors
   */
  static stdout(text: string): ProgressLine {
    return ProgressLine.make({ channel: "stdout", text })
  }

  /**
   * Constructs a stderr progress line for warnings, retries, and failures.
   *
   * @since 0.3.0
   * @category constructors
   */
  static stderr(text: string): ProgressLine {
    return ProgressLine.make({ channel: "stderr", text })
  }
}

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

const resolveRenderMode = (
  options?: {
    readonly renderMode?: TerminalRenderMode
  }
): TerminalRenderMode =>
  options?.renderMode === "tty"
    ? "tty"
    : "plain"

const projectLine = (event: StudyEvent.StudyEvent, renderMode: TerminalRenderMode): ProgressLine =>
  Match.value(event).pipe(
    Match.tag(
      "TrialStarted",
      ({ trialNumber }) => ProgressLine.stdout(withColor(renderMode, ANSI_BLUE, `trial#${trialNumber} started`))
    ),
    Match.tag(
      "TrialReported",
      ({ trialNumber, step, value, decision }) =>
        ProgressLine.stdout(
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
        ProgressLine.stdout(
          withColor(renderMode, ANSI_GREEN, `trial#${trialNumber} completed value=${objectiveValueText(value)}`)
        )
    ),
    Match.tag(
      "TrialCosted",
      ({ trialNumber, cost, cumulativeCost }) =>
        ProgressLine.stdout(
          withColor(renderMode, ANSI_BLUE, `trial#${trialNumber} cost=${cost} cumulative=${cumulativeCost}`)
        )
    ),
    Match.tag(
      "TrialPruned",
      ({ trialNumber, step, reason, policy }) =>
        ProgressLine.stdout(
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
        ProgressLine.stderr(
          withColor(renderMode, ANSI_YELLOW, `trial#${trialNumber} retried attempt=${attempt} error=${error._tag}`)
        )
    ),
    Match.tag(
      "TrialCancelled",
      ({ trialNumber, reason }) =>
        ProgressLine.stderr(withColor(renderMode, ANSI_YELLOW, `trial#${trialNumber} cancelled reason=${reason}`))
    ),
    Match.tag(
      "TrialFailed",
      ({ trialNumber, error }) =>
        ProgressLine.stderr(
          withColor(renderMode, ANSI_RED, `trial#${trialNumber} failed error=${error._tag} message=${error.message}`)
        )
    ),
    Match.tag(
      "BestUpdated",
      ({ trialNumber, value }) =>
        ProgressLine.stdout(withColor(renderMode, ANSI_GREEN, `best-updated trial#${trialNumber} value=${value}`))
    ),
    Match.tag(
      "StudyStopRequested",
      ({ mode, reason, requestedByTrialNumber }) =>
        ProgressLine.stdout(
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
        ProgressLine.stdout(
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
        ProgressLine.stdout(
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
        ProgressLine.stdout(
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
        ProgressLine.stdout(
          withColor(
            renderMode,
            ANSI_GREEN,
            `bracket#${bracketIndex} completed rounds=${rounds} best=${bestValue ?? "none"}`
          )
        )
    ),
    Match.tag(
      "StudyCompleted",
      ({ completionReason }) =>
        ProgressLine.stdout(withColor(renderMode, ANSI_GREEN, `study completed reason=${completionReason}`))
    ),
    Match.exhaustive
  )
