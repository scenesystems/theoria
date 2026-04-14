/**
 * Source-agnostic execution evidence projection for normalized coding traces.
 *
 * @since 0.2.0
 */
import { Array as Arr, Option } from "effect"

import type { OpenAgentTraceRecord, OpenAgentTraceRuntimeEvent } from "../schema.js"
import { CodingCheckRun, CodingEvidenceProjection } from "./schema.js"
import {
  bashExecutionEvents,
  filePathsFromFieldRecord,
  filePathsFromText,
  lowerCase,
  stableUniqueStrings,
  toolNamesFromRecord
} from "./shared.js"

const checkCommandSignals =
  /(bun run (test|lint|check|build)|vitest|eslint|tsc|jest|pytest|cargo test|go test|ruff|mypy)/iu
const failureOutputSignals = Arr.make("failed", "error", "exception", "traceback")

const isCheckCommand = (command: string): boolean => checkCommandSignals.test(command)

const failureSignalFromCommand = (event: OpenAgentTraceRuntimeEvent): ReadonlyArray<string> => {
  const command = Option.fromNullable(event.command).pipe(Option.getOrElse(() => ""))
  const outputText = Option.fromNullable(event.outputText).pipe(Option.getOrElse(() => ""))
  const normalizedOutput = lowerCase(outputText)
  const exitCodeFailure = Option.fromNullable(event.exitCode).pipe(
    Option.match({
      onNone: () => Arr.empty<string>(),
      onSome: (exitCode) => (exitCode === 0 ? Arr.empty<string>() : Arr.of(`Command failed (${exitCode}): ${command}`))
    })
  )

  return stableUniqueStrings(
    Arr.appendAll(
      event.cancelled === true
        ? Arr.of(`Cancelled command: ${command}`)
        : exitCodeFailure,
      failureOutputSignals.some((signal) => normalizedOutput.includes(signal))
        ? Arr.of(outputText.slice(0, 200))
        : Arr.empty<string>()
    )
  )
}

const checkRunFromEvent = (event: OpenAgentTraceRuntimeEvent): Option.Option<CodingCheckRun> =>
  Option.fromNullable(event.command).pipe(
    Option.filter(isCheckCommand),
    Option.map(
      (command) =>
        new CodingCheckRun({
          command,
          exitCode: event.exitCode,
          passed: event.cancelled !== true &&
            Option.fromNullable(event.exitCode).pipe(
              Option.match({ onNone: () => true, onSome: (exitCode) => exitCode === 0 })
            ),
          cancelled: event.cancelled === true
        })
    )
  )

/**
 * Projects execution evidence from a normalized coding trace without
 * source-specific tool or dataset assumptions.
 *
 * @since 0.2.0
 * @category constructors
 */
export const projectCodingEvidence = (record: OpenAgentTraceRecord): CodingEvidenceProjection => {
  const commands = bashExecutionEvents(record)

  return new CodingEvidenceProjection({
    fileTouches: stableUniqueStrings(
      Arr.appendAll(
        Arr.flatMap(commands, (event) => filePathsFromText(event.command ?? "")),
        Arr.flatMap(record.events, (event) =>
          event.eventKind === "message"
            ? Arr.flatMap(event.contentBlocks, (block) =>
              block.type === "toolCall" ? filePathsFromFieldRecord(block.arguments) : Arr.empty<string>())
            : event.eventKind === "custom-message"
            ? Arr.flatMap(event.contentBlocks ?? Arr.empty(), (block) =>
              block.type === "toolCall" ? filePathsFromFieldRecord(block.arguments) : Arr.empty<string>())
            : Arr.empty<string>())
      )
    ),
    checkRuns: Arr.filterMap(commands, checkRunFromEvent),
    failureSignals: stableUniqueStrings(Arr.flatMap(commands, failureSignalFromCommand)),
    toolNames: toolNamesFromRecord(record),
    commandCount: Arr.filterMap(commands, (event) => Option.fromNullable(event.command)).length
  })
}
