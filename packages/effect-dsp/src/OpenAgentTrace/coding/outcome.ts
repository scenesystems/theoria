/**
 * Source-agnostic outcome projection for normalized coding traces.
 *
 * @since 0.2.0
 */
import { Array as Arr, Option } from "effect"

import type { OpenAgentTraceRecord } from "../schema.js"
import { projectCodingEvidence } from "./evidence.js"
import { type CodingOutcomeKind, CodingOutcomeProjection } from "./schema.js"
import { assistantMessages, messageLikeText } from "./shared.js"

const finalAssistantMessage = (record: OpenAgentTraceRecord) =>
  Arr.last(assistantMessages(record)).pipe(
    Option.map(messageLikeText),
    Option.filter((text) => text.trim().length > 0)
  )

const classifyOutcome = (options: {
  readonly completed: boolean
  readonly checksPassed: Option.Option<boolean>
  readonly cancelled: boolean
  readonly hasFailures: boolean
}): CodingOutcomeKind => {
  if (!options.completed && options.cancelled) {
    return "interrupted"
  }

  if (Option.isSome(options.checksPassed)) {
    if (options.completed && options.checksPassed.value && !options.hasFailures) {
      return "success"
    }

    if (!options.completed && !options.checksPassed.value) {
      return "failure"
    }

    if (options.completed && !options.checksPassed.value) {
      return "mixed"
    }
  }

  if (!options.completed && options.hasFailures) {
    return "failure"
  }

  return options.completed ? "success" : "unknown"
}

/**
 * Projects the end-of-task outcome from a normalized coding trace.
 *
 * @since 0.2.0
 * @category constructors
 */
export const projectCodingOutcome = (
  record: OpenAgentTraceRecord,
  evidence = projectCodingEvidence(record)
): CodingOutcomeProjection => {
  const finalMessage = finalAssistantMessage(record)
  const completed = Option.isSome(finalMessage)
  const checksPassed = evidence.checkRuns.length > 0
    ? Option.some(Arr.every(evidence.checkRuns, (check) => check.passed))
    : Option.none<boolean>()
  const cancelled = Arr.some(evidence.checkRuns, (check) => check.cancelled)
  const hasFailures = evidence.failureSignals.length > 0
  const blockingReason = Arr.last(evidence.failureSignals).pipe(
    Option.orElse(() => (cancelled ? Option.some("Execution was cancelled before completion.") : Option.none()))
  )

  return new CodingOutcomeProjection({
    outcome: classifyOutcome({ completed, checksPassed, cancelled, hasFailures }),
    completed,
    ...Option.match(checksPassed, {
      onNone: () => ({}),
      onSome: (value) => ({ checksPassed: value })
    }),
    ...Option.match(finalMessage, {
      onNone: () => ({}),
      onSome: (value) => ({ finalAssistantMessage: value })
    }),
    ...Option.match(blockingReason, {
      onNone: () => ({}),
      onSome: (value) => ({ blockingReason: value })
    })
  })
}
