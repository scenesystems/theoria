/**
 * Source-agnostic task projection for normalized coding traces.
 *
 * @since 0.2.0
 */
import { Array as Arr, Option } from "effect"

import type { OpenAgentTraceRecord } from "../schema.js"
import { CodingTaskProjection, type CodingWorkKind } from "./schema.js"
import {
  filePathsFromText,
  instructionEventTexts,
  lowerCase,
  splitTextUnits,
  stableUniqueStrings,
  summaryText
} from "./shared.js"

const constraintSignals = Arr.make("do not", "don't", "must", "without", "keep", "avoid", "only", "cannot", "strict")

const classifyWorkKind = (text: string): CodingWorkKind => {
  const normalized = lowerCase(text)

  if (normalized.includes("review")) {
    return "review"
  }

  if (normalized.includes("migrat") || normalized.includes("upgrade")) {
    return "migration"
  }

  if (normalized.includes("refactor") || normalized.includes("rename") || normalized.includes("restructure")) {
    return "refactor"
  }

  if (
    normalized.includes("repair") || normalized.includes("fix") || normalized.includes("bug") ||
    normalized.includes("regression")
  ) {
    return "repair"
  }

  if (
    normalized.includes("implement") ||
    normalized.includes("build") ||
    normalized.includes("add") ||
    normalized.includes("create") ||
    normalized.includes("ship")
  ) {
    return "implementation"
  }

  return "unknown"
}

const constraintLines = (texts: ReadonlyArray<string>): ReadonlyArray<string> =>
  stableUniqueStrings(
    Arr.flatMap(texts, (text) =>
      Arr.filter(splitTextUnits(text), (unit) =>
        constraintSignals.some((signal) => lowerCase(unit).includes(signal))))
  )

/**
 * Projects the initiating task from a normalized coding trace without relying
 * on source-specific adapter payloads.
 *
 * @since 0.2.0
 * @category constructors
 */
export const projectCodingTask = (record: OpenAgentTraceRecord): CodingTaskProjection => {
  const instructionTexts = instructionEventTexts(record)
  const promptEntry = Arr.head(instructionTexts)
  const supportingTexts = Arr.map(instructionTexts, ([, text]) => text)
  const promptEventId = Option.match(promptEntry, {
    onNone: () => record.selection.selectedLeafEntryId,
    onSome: ([eventId]) => eventId
  })
  const promptText = Option.match(promptEntry, {
    onNone: () => Arr.join(supportingTexts, "\n"),
    onSome: ([, prompt]) => prompt
  })
  const files = stableUniqueStrings(Arr.flatMap(supportingTexts, filePathsFromText))

  return new CodingTaskProjection({
    taskId: `${record.session.sessionId}:${promptEventId}`,
    sessionId: record.session.sessionId,
    workKind: classifyWorkKind(Arr.join(supportingTexts, "\n")),
    summary: summaryText(promptText),
    prompt: promptText,
    constraints: constraintLines(supportingTexts),
    files
  })
}
