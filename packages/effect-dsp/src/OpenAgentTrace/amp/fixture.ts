/**
 * Strict loading and validation for checked-in public Amp fixtures.
 *
 * @since 0.2.0
 */
import { Effect, Schema } from "effect"

import { OpenAgentTraceAdapterCapture, OpenAgentTraceAdapterCaptureSource } from "../adapterSchema.js"
import { decodeOpenAgentTraceContentDigest } from "../schema.js"
import { AmpCaptureEvidence, type AmpCaptureEvidence as AmpCaptureEvidenceModel } from "./captureEvidence.js"
import {
  AmpFixtureDecodeError as AmpFixtureDecodeErrorInternal,
  AmpFixtureDigestMismatchError as AmpFixtureDigestMismatchErrorInternal,
  type AmpFixtureLane,
  AmpFixtureReadError as AmpFixtureReadErrorInternal,
  AmpFixtureSemanticValidationError as AmpFixtureSemanticValidationErrorInternal,
  decodeJson,
  filesFor,
  parseJsonLines,
  readFileString,
  validateDigest,
  validateEvidence,
  validatePluginCapture,
  validateStreamCapture
} from "./fixtureSupport.js"
import { AmpPluginCapture } from "./schema.js"
import { AmpStreamJsonCapture } from "./streamJson.js"

/**
 * Canonical public Amp thread used as the checked-in fixture authority for this package.
 *
 * @since 0.2.0
 */
export const AMP_PUBLIC_THREAD_ID = "T-019d8314-fca6-75bd-b996-2adcb0f10fa2"

/**
 * Typed decode failure for checked-in Amp fixture artifacts.
 *
 * @since 0.2.0
 */
export const AmpFixtureDecodeError = AmpFixtureDecodeErrorInternal

/**
 * Typed digest mismatch raised when a raw fixture no longer matches its recorded provenance digest.
 *
 * @since 0.2.0
 */
export const AmpFixtureDigestMismatchError = AmpFixtureDigestMismatchErrorInternal

/**
 * Typed read failure for checked-in Amp fixture artifacts.
 *
 * @since 0.2.0
 */
export const AmpFixtureReadError = AmpFixtureReadErrorInternal

/**
 * Typed semantic validation failure for authoritative Amp fixture metadata or lifecycle invariants.
 *
 * @since 0.2.0
 */
export const AmpFixtureSemanticValidationError = AmpFixtureSemanticValidationErrorInternal

/**
 * Loads the checked-in provenance sidecar for one authoritative Amp public-thread fixture lane.
 *
 * @since 0.2.0
 */
export const loadCaptureEvidence = (rootPath: string, lane: AmpFixtureLane, threadId = AMP_PUBLIC_THREAD_ID) =>
  Effect.flatMap(
    readFileString(filesFor(lane, threadId, rootPath).evidence),
    (raw) => decodeJson(AmpCaptureEvidence, filesFor(lane, threadId, rootPath).evidence, raw)
  )

const loadEvidence = (rootPath: string, lane: AmpFixtureLane, threadId: string) =>
  loadCaptureEvidence(rootPath, lane, threadId).pipe(
    Effect.flatMap((evidence) => validateEvidence(lane, threadId, evidence))
  )

/**
 * Loads the Plugin API replay capture after verifying the raw artifact digest and thread authority.
 *
 * @since 0.2.0
 */
export const loadPluginCapture = (rootPath: string, threadId = AMP_PUBLIC_THREAD_ID) =>
  Effect.gen(function*() {
    const files = filesFor("plugin", threadId, rootPath)
    const evidence = yield* loadEvidence(rootPath, "plugin", threadId)
    const raw = yield* readFileString(files.raw)
    const derivedRaw = yield* readFileString(files.derived)
    yield* validateDigest(files.raw, raw, evidence.resolved.rawDigest)
    const rawCapture = yield* decodeJson(AmpPluginCapture, files.raw, raw)
    const derivedCapture = yield* decodeJson(AmpPluginCapture, files.derived, derivedRaw)
    yield* validatePluginCapture(rawCapture)
    yield* validatePluginCapture(derivedCapture)

    return yield* (rawCapture.threadId === derivedCapture.threadId
      ? Effect.succeed(derivedCapture)
      : Effect.fail(
        new AmpFixtureDecodeErrorInternal({
          path: files.derived,
          message: "plugin derived capture diverges from raw thread authority"
        })
      ))
  })

/**
 * Loads the stream-json replay capture after verifying the raw artifact digest and lane semantics.
 *
 * @since 0.2.0
 */
export const loadStreamJsonCapture = (rootPath: string, threadId = AMP_PUBLIC_THREAD_ID) =>
  Effect.gen(function*() {
    const files = filesFor("stream-json", threadId, rootPath)
    const evidence = yield* loadEvidence(rootPath, "stream-json", threadId)
    const raw = yield* readFileString(files.raw)
    const derivedRaw = yield* readFileString(files.derived)
    yield* validateDigest(files.raw, raw, evidence.resolved.rawDigest)
    const rawCapture = yield* Schema.decodeUnknown(AmpStreamJsonCapture)({
      startedAt: evidence.observed.startedAt,
      lines: yield* parseJsonLines(files.raw, raw)
    }).pipe(
      Effect.mapError(() =>
        new AmpFixtureDecodeErrorInternal({ path: files.raw, message: "failed to decode raw stream fixture" })
      )
    )
    const derivedCapture = yield* decodeJson(AmpStreamJsonCapture, files.derived, derivedRaw)
    yield* validateStreamCapture(threadId, rawCapture)
    yield* validateStreamCapture(threadId, derivedCapture)

    return yield* (rawCapture.lines.length === derivedCapture.lines.length
      ? Effect.succeed(derivedCapture)
      : Effect.fail(
        new AmpFixtureDecodeErrorInternal({
          path: files.derived,
          message: "stream derived capture diverges from raw thread authority"
        })
      ))
  })

const makeAdapterCapture = (options: {
  lane: AmpFixtureLane
  threadId: string
  evidence: AmpCaptureEvidenceModel
  payload: typeof AmpPluginCapture.Type | typeof AmpStreamJsonCapture.Type
}) =>
  Effect.gen(function*() {
    const sourceHash = yield* decodeOpenAgentTraceContentDigest(options.evidence.resolved.sourceHash)
    const source = OpenAgentTraceAdapterCaptureSource.make({
      adapterKind: options.lane === "plugin" ? "amp-plugin" : "amp-stream-json",
      sourceId: `amp-public-thread:${options.threadId}:${options.lane}`,
      sourceRevision: "raw-v1",
      sourceUrl: options.evidence.desired.sourceUrl,
      licenseTag: "amp-public-thread",
      harness: options.lane === "plugin" ? "amp-plugin" : "amp-cli",
      sessionId: options.evidence.resolved.sessionId,
      fileName: options.evidence.resolved.rawFileName,
      sourceHash
    })

    return OpenAgentTraceAdapterCapture.make({
      captureId: `amp-${options.lane}:${options.threadId}`,
      source,
      payload: options.payload,
      capturedAt: options.evidence.observed.capturedAt
    })
  })

/**
 * Builds the package-owned Plugin API adapter capture with truthful raw-artifact source metadata.
 *
 * @since 0.2.0
 */
export const loadPluginAdapterCapture = (rootPath: string, threadId = AMP_PUBLIC_THREAD_ID) =>
  Effect.all({
    evidence: loadEvidence(rootPath, "plugin", threadId),
    payload: loadPluginCapture(rootPath, threadId)
  }).pipe(
    Effect.flatMap(({ evidence, payload }) => makeAdapterCapture({ lane: "plugin", threadId, evidence, payload }))
  )

/**
 * Builds the package-owned stream-json adapter capture with truthful raw-artifact source metadata.
 *
 * @since 0.2.0
 */
export const loadStreamJsonAdapterCapture = (rootPath: string, threadId = AMP_PUBLIC_THREAD_ID) =>
  Effect.all({
    evidence: loadEvidence(rootPath, "stream-json", threadId),
    payload: loadStreamJsonCapture(rootPath, threadId)
  }).pipe(
    Effect.flatMap(({ evidence, payload }) => makeAdapterCapture({ lane: "stream-json", threadId, evidence, payload }))
  )
