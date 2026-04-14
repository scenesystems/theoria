/**
 * Internal helpers for strict Amp fixture loading.
 *
 * @since 0.2.0
 */
import { FileSystem } from "@effect/platform"
import { digestUtf8Base64Url } from "@scenesystems/digest"
import { Effect, Option, Schema } from "effect"

import { type AmpCaptureEvidence as AmpCaptureEvidenceModel } from "./captureEvidence.js"
import { type AmpPluginCapture as AmpPluginCaptureModel } from "./schema.js"
import { type AmpStreamJsonCapture as AmpStreamJsonCaptureModel } from "./streamJson.js"

/**
 * Supported authoritative Amp fixture lanes backed by checked-in public thread captures.
 *
 * @since 0.2.0
 */
export type AmpFixtureLane = "plugin" | "stream-json"

/**
 * Typed read failure for checked-in Amp fixture artifacts.
 *
 * @since 0.2.0
 */
export class AmpFixtureReadError extends Schema.TaggedError<AmpFixtureReadError>()("AmpFixtureReadError", {
  path: Schema.String,
  message: Schema.String
}) {}

/**
 * Typed decode failure for checked-in Amp fixture artifacts.
 *
 * @since 0.2.0
 */
export class AmpFixtureDecodeError extends Schema.TaggedError<AmpFixtureDecodeError>()("AmpFixtureDecodeError", {
  path: Schema.String,
  message: Schema.String
}) {}

/**
 * Typed digest mismatch raised when a raw fixture no longer matches its recorded provenance digest.
 *
 * @since 0.2.0
 */
export class AmpFixtureDigestMismatchError
  extends Schema.TaggedError<AmpFixtureDigestMismatchError>()("AmpFixtureDigestMismatchError", {
    path: Schema.String,
    expected: Schema.String,
    actual: Schema.String
  })
{}

/**
 * Typed semantic validation failure for authoritative Amp fixture metadata or lifecycle invariants.
 *
 * @since 0.2.0
 */
export class AmpFixtureSemanticValidationError
  extends Schema.TaggedError<AmpFixtureSemanticValidationError>()("AmpFixtureSemanticValidationError", {
    lane: Schema.String,
    threadId: Schema.String,
    message: Schema.String
  })
{}

const decodeUnknownJson = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))

/**
 * Reads one checked-in Amp fixture artifact through the platform file-system service.
 *
 * @since 0.2.0
 */
export const readFileString = (filePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFileString(filePath).pipe(
      Effect.mapError(() => new AmpFixtureReadError({ path: filePath, message: "failed to read fixture" }))
    )
  })

/**
 * Decodes one JSON fixture string into the requested package-owned schema.
 *
 * @since 0.2.0
 */
export const decodeJson = <A>(schema: Schema.Schema<A>, path: string, raw: string) =>
  decodeUnknownJson(raw).pipe(
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.mapError(() => new AmpFixtureDecodeError({ path, message: "failed to decode JSON fixture" }))
  )

/**
 * Decodes one authoritative JSONL capture while preserving the checked-in event order.
 *
 * @since 0.2.0
 */
export const parseJsonLines = (path: string, raw: string) =>
  Effect.forEach(raw.split("\n").filter((line) => line.length > 0), (line) =>
    decodeUnknownJson(line).pipe(
      Effect.mapError(() => new AmpFixtureDecodeError({ path, message: "malformed JSONL fixture" }))
    ), { concurrency: 1 })

const duplicateValues = (values: ReadonlyArray<string>) =>
  values.filter((value, index) => values.indexOf(value) !== index).filter((value, index, all) =>
    all.indexOf(value) === index
  )

const uniqueValues = (values: ReadonlyArray<string>) => values.filter((value, index) => values.indexOf(value) === index)

/**
 * Resolves the authoritative raw, provenance, and derived replay paths for one Amp fixture lane.
 *
 * @since 0.2.0
 */
export const filesFor = (lane: AmpFixtureLane, threadId: string, rootPath: string) => ({
  raw: `${rootPath}/raw/${threadId}/${lane}.raw.${lane === "plugin" ? "json" : "jsonl"}`,
  evidence: `${rootPath}/raw/${threadId}/${lane}.evidence.json`,
  derived: `${rootPath}/derived/${threadId}/${lane}.capture.json`
})

/**
 * Verifies the provenance sidecar still matches the requested public thread and lane metadata.
 *
 * @since 0.2.0
 */
export const validateEvidence = (lane: AmpFixtureLane, threadId: string, evidence: AmpCaptureEvidenceModel) =>
  evidence.desired.threadId === threadId &&
    evidence.resolved.threadId === threadId &&
    evidence.resolved.sessionId === threadId &&
    evidence.resolved.rawFileName === `${lane}.raw.${lane === "plugin" ? "json" : "jsonl"}`
    ? Effect.succeed(evidence)
    : Effect.fail(
      new AmpFixtureSemanticValidationError({
        lane,
        threadId,
        message: "fixture evidence does not match the authoritative public thread metadata"
      })
    )

/**
 * Verifies one checked-in raw artifact against the digest recorded in its provenance sidecar.
 *
 * @since 0.2.0
 */
export const validateDigest = (path: string, raw: string, expected: string) =>
  Effect.flatMap(digestUtf8Base64Url("blake3-256", raw), (digest) => {
    const actual = `blake3-256:${digest}`
    return actual === expected
      ? Effect.succeed(actual)
      : Effect.fail(new AmpFixtureDigestMismatchError({ path, expected, actual }))
  })

/**
 * Rejects Plugin API captures whose tool lifecycle ids or thread authority drift from the raw thread facts.
 *
 * @since 0.2.0
 */
export const validatePluginCapture = (capture: AmpPluginCaptureModel) => {
  const callIds = capture.turns.flatMap((turn) =>
    turn.events.flatMap((event) => event.type === "tool.call" ? [event.payload.toolUseID] : [])
  )
  const resultIds = capture.turns.flatMap((turn) =>
    turn.events.flatMap((event) => event.type === "tool.result" ? [event.payload.toolUseID] : [])
  )
  const missingCalls = resultIds.filter((toolUseID) => !callIds.includes(toolUseID))
  const duplicateCalls = duplicateValues(callIds)
  const duplicateResults = duplicateValues(resultIds)
  const sessionThreadMismatch = Option.fromNullable(capture.sessionStart.payload.thread?.id).pipe(
    Option.match({
      onNone: () => false,
      onSome: (threadId) => threadId !== capture.threadId
    })
  )
  const inconsistentThreads = capture.turns.flatMap((turn) =>
    turn.events.flatMap((event) =>
      event.type !== "tool.call"
        ? []
        : Option.fromNullable(event.payload.thread?.id).pipe(
          Option.match({
            onNone: () => [],
            onSome: (threadId) => (threadId === capture.threadId ? [] : [threadId])
          })
        )
    )
  )

  return missingCalls.length === 0 &&
      duplicateCalls.length === 0 &&
      duplicateResults.length === 0 &&
      inconsistentThreads.length === 0 &&
      sessionThreadMismatch === false
    ? Effect.succeed(capture)
    : Effect.fail(
      new AmpFixtureSemanticValidationError({
        lane: "plugin",
        threadId: capture.threadId,
        message: "plugin raw fixture has unmatched tool lifecycle ids or inconsistent thread authority"
      })
    )
}

/**
 * Rejects stream-json captures whose session authority or tool lifecycle ids diverge from the raw lane contract.
 *
 * @since 0.2.0
 */
export const validateStreamCapture = (threadId: string, capture: AmpStreamJsonCaptureModel) => {
  const sessionIds = uniqueValues(capture.lines.map((line) => line.session_id))
  const hasInitLine = capture.lines.some((line) => line.type === "system" && line.subtype === "init")
  const toolUseIds = capture.lines.flatMap((line) =>
    line.type === "assistant"
      ? line.message.content.flatMap((block) => block.type === "tool_use" ? [block.id] : [])
      : []
  )
  const toolResultIds = capture.lines.flatMap((line) =>
    line.type === "user"
      ? line.message.content.flatMap((block) => block.type === "tool_result" ? [block.tool_use_id] : [])
      : []
  )

  return hasInitLine &&
      sessionIds.length === 1 &&
      sessionIds[0] === threadId &&
      duplicateValues(toolUseIds).length === 0 &&
      toolResultIds.every((id) => toolUseIds.includes(id))
    ? Effect.succeed(capture)
    : Effect.fail(
      new AmpFixtureSemanticValidationError({
        lane: "stream-json",
        threadId,
        message: "stream-json raw fixture has invalid lane metadata or unmatched tool lifecycle ids"
      })
    )
}
