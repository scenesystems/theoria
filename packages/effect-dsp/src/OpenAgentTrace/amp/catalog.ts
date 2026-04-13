/**
 * Package-owned checked-in catalog for public Amp fixture threads.
 *
 * @since 0.2.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Order, Schema } from "effect"

import { AmpCaptureMethod, AmpThreadId } from "./captureEvidence.js"
import { loadCaptureEvidence } from "./fixture.js"

const moduleDirectoryUrl = new URL(".", import.meta.url)
const fixtureRootSegments = Arr.make("fixtures", "open-agent-trace", "amp")
const AmpFixtureLaneSchema = Schema.Literal("plugin", "stream-json")
const catalogLanes: readonly ["plugin", "stream-json"] = ["plugin", "stream-json"]
const toolOrder = Order.string
const derivedReplayAuthority = "checked-in-derived-replay"

/**
 * Shared thread facts that both authoritative Amp capture lanes must agree on.
 *
 * @since 0.2.0
 * @category models
 */
export class AmpFixtureCatalogSharedFacts extends Schema.Class<AmpFixtureCatalogSharedFacts>(
  "OpenAgentTrace/AmpFixtureCatalogSharedFacts"
)({
  firstTaskSummary: Schema.String,
  shellCommands: Schema.Array(Schema.String)
}) {}

/**
 * Lane-specific provenance and replay facts for one checked-in Amp fixture.
 *
 * @since 0.2.0
 * @category models
 */
export class AmpFixtureCatalogLaneFacts extends Schema.Class<AmpFixtureCatalogLaneFacts>(
  "OpenAgentTrace/AmpFixtureCatalogLaneFacts"
)({
  captureMethod: AmpCaptureMethod,
  rawFileName: Schema.String,
  derivedFileName: Schema.String,
  rawArtifactAuthority: Schema.Literal(true),
  derivedReplayAuthority: Schema.Literal(derivedReplayAuthority),
  toolNames: Schema.Array(Schema.String),
  terminalStatus: Schema.Literal("done", "error", "interrupted", "success"),
  coverageKinds: Schema.Array(Schema.String)
}) {}

/**
 * One checked-in public Amp fixture thread with both authoritative capture lanes.
 *
 * @since 0.2.0
 * @category models
 */
export class AmpFixtureCatalogEntry extends Schema.Class<AmpFixtureCatalogEntry>(
  "OpenAgentTrace/AmpFixtureCatalogEntry"
)({
  threadId: AmpThreadId,
  sourceUrl: Schema.String,
  lanes: Schema.NonEmptyArray(AmpFixtureLaneSchema),
  shared: AmpFixtureCatalogSharedFacts,
  plugin: AmpFixtureCatalogLaneFacts,
  streamJson: AmpFixtureCatalogLaneFacts
}) {}

/**
 * Typed read failure for the checked-in Amp fixture catalog.
 *
 * @since 0.2.0
 */
export class AmpFixtureCatalogReadError extends Schema.TaggedError<AmpFixtureCatalogReadError>()(
  "AmpFixtureCatalogReadError",
  { path: Schema.String, message: Schema.String }
) {}

const joinSegments = (path: Path.Path, directory: string, segments: ReadonlyArray<string>): string =>
  Arr.reduce(segments, directory, (current, segment) => path.join(current, segment))

const sameOrderedStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  Arr.join(left, "\u0000") === Arr.join(right, "\u0000")

const fixtureRootExists = (
  candidate: string
): Effect.Effect<boolean, AmpFixtureCatalogReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const rawExists = yield* fileSystem.exists(path.join(candidate, "raw")).pipe(
      Effect.mapError(() =>
        new AmpFixtureCatalogReadError({ path: candidate, message: "failed to resolve Amp fixture root" })
      )
    )
    const derivedExists = yield* fileSystem.exists(path.join(candidate, "derived")).pipe(
      Effect.mapError(() =>
        new AmpFixtureCatalogReadError({ path: candidate, message: "failed to resolve Amp fixture root" })
      )
    )

    return rawExists && derivedExists
  })

const resolveFixtureRoot = (
  directory: string
): Effect.Effect<string, AmpFixtureCatalogReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const candidate = joinSegments(path, directory, fixtureRootSegments)
    const exists = yield* fixtureRootExists(candidate)

    if (exists) {
      return candidate
    }

    const parent = path.dirname(directory)

    return parent === directory
      ? yield* Effect.fail(
        new AmpFixtureCatalogReadError({ path: candidate, message: "failed to resolve Amp fixture root" })
      )
      : yield* resolveFixtureRoot(parent)
  })

/**
 * Resolve the package-owned checked-in Amp fixture root from the module location.
 *
 * @since 0.2.0
 * @category constructors
 */
export const loadCheckedInAmpFixtureRoot = () =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const moduleDirectory = yield* path.fromFileUrl(moduleDirectoryUrl).pipe(
      Effect.mapError(() =>
        new AmpFixtureCatalogReadError({
          path: moduleDirectoryUrl.href,
          message: "failed to resolve Amp fixture module directory"
        })
      )
    )

    return yield* resolveFixtureRoot(moduleDirectory)
  })

const loadCatalogEntry = (rootPath: string, threadId: string) =>
  Effect.gen(function*() {
    const catalogThreadId = yield* Schema.decodeUnknown(AmpThreadId)(threadId)
    const pluginEvidence = yield* loadCaptureEvidence(rootPath, "plugin", threadId)
    const streamEvidence = yield* loadCaptureEvidence(rootPath, "stream-json", threadId)
    const sharedFactsAgree = pluginEvidence.desired.sourceUrl === streamEvidence.desired.sourceUrl &&
      pluginEvidence.observed.firstTaskSummary === streamEvidence.observed.firstTaskSummary &&
      sameOrderedStrings(pluginEvidence.observed.shellCommands, streamEvidence.observed.shellCommands)

    return yield* (sharedFactsAgree
      ? Effect.succeed(
        new AmpFixtureCatalogEntry({
          threadId: catalogThreadId,
          sourceUrl: pluginEvidence.desired.sourceUrl,
          lanes: catalogLanes,
          shared: new AmpFixtureCatalogSharedFacts({
            firstTaskSummary: pluginEvidence.observed.firstTaskSummary,
            shellCommands: pluginEvidence.observed.shellCommands
          }),
          plugin: new AmpFixtureCatalogLaneFacts({
            captureMethod: pluginEvidence.desired.captureMethod,
            rawFileName: pluginEvidence.resolved.rawFileName,
            derivedFileName: pluginEvidence.resolved.derivedFileName,
            rawArtifactAuthority: pluginEvidence.reviewBoundary.rawArtifactAuthority,
            derivedReplayAuthority: pluginEvidence.reviewBoundary.derivedReplayAuthority,
            toolNames: Arr.sort(pluginEvidence.observed.toolNames, toolOrder),
            terminalStatus: pluginEvidence.observed.terminalStatus,
            coverageKinds: pluginEvidence.observed.coverageKinds
          }),
          streamJson: new AmpFixtureCatalogLaneFacts({
            captureMethod: streamEvidence.desired.captureMethod,
            rawFileName: streamEvidence.resolved.rawFileName,
            derivedFileName: streamEvidence.resolved.derivedFileName,
            rawArtifactAuthority: streamEvidence.reviewBoundary.rawArtifactAuthority,
            derivedReplayAuthority: streamEvidence.reviewBoundary.derivedReplayAuthority,
            toolNames: Arr.sort(streamEvidence.observed.toolNames, toolOrder),
            terminalStatus: streamEvidence.observed.terminalStatus,
            coverageKinds: streamEvidence.observed.coverageKinds
          })
        })
      )
      : Effect.fail(
        new AmpFixtureCatalogReadError({
          path: rootPath,
          message: `fixture lanes disagree about shared thread facts for '${threadId}'`
        })
      ))
  })

/**
 * Load the checked-in public Amp fixture catalog from the package-owned fixture root.
 *
 * @since 0.2.0
 * @category constructors
 */
export const loadCheckedInAmpFixtureCatalog = () =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const fixtureRoot = yield* loadCheckedInAmpFixtureRoot()
    const rawRoot = path.join(fixtureRoot, "raw")
    const threadIds = yield* fileSystem.readDirectory(rawRoot).pipe(
      Effect.mapError(() =>
        new AmpFixtureCatalogReadError({ path: rawRoot, message: "failed to read Amp fixture raw directory" })
      )
    )

    return yield* Effect.forEach(
      Arr.sort(threadIds, Order.string),
      (threadId) => loadCatalogEntry(fixtureRoot, threadId),
      { concurrency: 1 }
    )
  })

/**
 * Load the deterministic thread-id list for the checked-in Amp fixture catalog.
 *
 * @since 0.2.0
 * @category constructors
 */
export const loadCheckedInAmpFixtureThreadIds = () =>
  loadCheckedInAmpFixtureCatalog().pipe(
    Effect.map((entries) => Arr.map(entries, (entry) => entry.threadId))
  )
