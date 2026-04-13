/**
 * Checked-in repository-fixture resolution for execution-backed coding proofs.
 *
 * @since 0.2.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Schema } from "effect"

import { CodingExecutionFixture, type CodingExecutionFixture as CodingExecutionFixtureModel } from "./schema.js"

const decodeUnknownJson = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))
const moduleDirectoryUrl = new URL(".", import.meta.url)
const fixtureRootSegments = Arr.make("fixtures", "open-agent-trace", "coding", "execution")

/**
 * Canonical checked-in execution fixture used by the implementation-strategy proof.
 *
 * @since 0.2.0
 */
export const COUNTER_ITEMS_EXECUTION_FIXTURE_ID = "amp-counter-items"

/**
 * Typed read failure for coding execution fixtures.
 *
 * @since 0.2.0
 */
export class CodingExecutionFixtureReadError extends Schema.TaggedError<CodingExecutionFixtureReadError>()(
  "CodingExecutionFixtureReadError",
  {
    path: Schema.String,
    message: Schema.String
  }
) {}

/**
 * Typed decode failure for coding execution fixtures.
 *
 * @since 0.2.0
 */
export class CodingExecutionFixtureDecodeError extends Schema.TaggedError<CodingExecutionFixtureDecodeError>()(
  "CodingExecutionFixtureDecodeError",
  {
    path: Schema.String,
    message: Schema.String
  }
) {}

/**
 * Resolved absolute paths for one checked-in execution fixture.
 *
 * @since 0.2.0
 * @category models
 */
export type ResolvedCodingExecutionFixture = Readonly<{
  readonly fixture: CodingExecutionFixtureModel
  readonly directory: string
  readonly repoRoot: string
}>

const joinSegments = (path: Path.Path, directory: string, segments: ReadonlyArray<string>): string =>
  Arr.reduce(segments, directory, (current, segment) => path.join(current, segment))

const resolveFixtureRoot = (
  directory: string
): Effect.Effect<string, CodingExecutionFixtureReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const candidate = joinSegments(path, directory, fixtureRootSegments)
    const exists = yield* fileSystem.exists(candidate).pipe(
      Effect.mapError(() =>
        new CodingExecutionFixtureReadError({ path: candidate, message: "failed to resolve execution fixture root" })
      )
    )

    if (exists) {
      return candidate
    }

    const parent = path.dirname(directory)

    return parent === directory
      ? yield* Effect.fail(
        new CodingExecutionFixtureReadError({ path: candidate, message: "failed to resolve execution fixture root" })
      )
      : yield* resolveFixtureRoot(parent)
  })

const readFileString = (path: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFileString(path).pipe(
      Effect.mapError(() => new CodingExecutionFixtureReadError({ path, message: "failed to read execution fixture" }))
    )
  })

/**
 * Load one checked-in coding execution fixture and resolve its repository root.
 *
 * @since 0.2.0
 * @category constructors
 */
export const loadCodingExecutionFixture = (fixtureId = COUNTER_ITEMS_EXECUTION_FIXTURE_ID) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const moduleDirectory = yield* path.fromFileUrl(moduleDirectoryUrl).pipe(
      Effect.mapError(() =>
        new CodingExecutionFixtureReadError({
          path: moduleDirectoryUrl.href,
          message: "failed to resolve execution fixture module directory"
        })
      )
    )
    const fixtureRoot = yield* resolveFixtureRoot(moduleDirectory)
    const directory = path.join(fixtureRoot, fixtureId)
    const manifestPath = path.join(directory, "fixture.json")
    const raw = yield* readFileString(manifestPath)
    const fixture = yield* decodeUnknownJson(raw).pipe(
      Effect.flatMap(Schema.decodeUnknown(CodingExecutionFixture)),
      Effect.mapError(() =>
        new CodingExecutionFixtureDecodeError({ path: manifestPath, message: "failed to decode execution fixture" })
      )
    )

    return {
      fixture,
      directory,
      repoRoot: path.join(directory, fixture.repoDirectory)
    }
  })
