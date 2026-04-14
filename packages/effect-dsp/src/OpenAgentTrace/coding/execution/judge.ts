/**
 * Execution-backed scoring over checked-in repository fixtures.
 *
 * @since 0.2.0
 */
import { Command, FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Schema, Stream } from "effect"

import { loadCodingExecutionFixture } from "./fixture.js"
import {
  type CodingExecutionFixture as CodingExecutionFixtureModel,
  CodingExecutionJudgeResult,
  type CodingExecutionRunManifestEntry,
  CodingExecutionRunResult
} from "./schema.js"

/**
 * Typed execution failure raised when fixture setup or command execution cannot complete.
 *
 * @since 0.2.0
 */
export class CodingExecutionJudgeError extends Schema.TaggedError<CodingExecutionJudgeError>()(
  "CodingExecutionJudgeError",
  {
    fixtureId: Schema.String,
    message: Schema.String
  }
) {}

const scoreFrom = (patchApplied: boolean, runs: ReadonlyArray<CodingExecutionRunResult>): number => {
  const passedRuns = Arr.filter(runs, (run) => run.passed).length
  return (passedRuns + (patchApplied ? 1 : 0)) / (runs.length + 1)
}

const feedbackFrom = (patchApplied: boolean, runs: ReadonlyArray<CodingExecutionRunResult>): string => {
  const passedStages = Arr.map(Arr.filter(runs, (run) => run.passed), (run) => run.stage)
  const failedStages = Arr.map(Arr.filter(runs, (run) => !run.passed), (run) => run.stage)

  return Arr.join(
    Arr.appendAll(
      Arr.appendAll(
        patchApplied ? Arr.make("Patch applied") : Arr.make("Patch not applied"),
        passedStages.length === 0 ? Arr.empty<string>() : Arr.make(`Passed: ${Arr.join(passedStages, ", ")}`)
      ),
      failedStages.length === 0 ? Arr.empty<string>() : Arr.make(`Failed: ${Arr.join(failedStages, ", ")}`)
    ),
    " | "
  )
}

const runManifestEntry = (cwd: string, entry: CodingExecutionRunManifestEntry) =>
  Effect.gen(function*() {
    const command = Command.make(...entry.command).pipe(
      Command.workingDirectory(cwd),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const process = yield* Command.start(command)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [
        process.exitCode,
        Stream.decodeText(process.stdout).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`)),
        Stream.decodeText(process.stderr).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`))
      ],
      { concurrency: "unbounded" }
    )

    return new CodingExecutionRunResult({
      stage: entry.stage,
      command: Arr.join(entry.command, " "),
      exitCode: Number(exitCode),
      passed: Number(exitCode) === 0,
      stdout,
      stderr
    })
  }).pipe(
    Effect.scoped,
    Effect.mapError(() =>
      new CodingExecutionJudgeError({ fixtureId: cwd, message: "failed to run execution manifest" })
    )
  )

const applyPatchFiles = (fixture: CodingExecutionFixtureModel, repoRoot: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    yield* Effect.forEach(fixture.patchFiles, (patchFile) =>
      Effect.gen(function*() {
        const target = path.join(repoRoot, patchFile.path)
        yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true }).pipe(
          Effect.mapError(() =>
            new CodingExecutionJudgeError({
              fixtureId: fixture.fixtureId,
              message: "failed to prepare patch directory"
            })
          )
        )
        yield* fileSystem.writeFileString(target, patchFile.content).pipe(
          Effect.mapError(() =>
            new CodingExecutionJudgeError({ fixtureId: fixture.fixtureId, message: "failed to write patched file" })
          )
        )
      }), { concurrency: 1 })

    return Arr.map(fixture.patchFiles, (patchFile) => patchFile.path)
  })

/**
 * Execute one checked-in repository fixture and score patch + manifest outcomes.
 *
 * @since 0.2.0
 * @category constructors
 */
export const judgeCodingExecutionFixture = (options: {
  readonly fixtureId: string
  readonly applyPatch: boolean
}) =>
  Effect.scoped(
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const resolved = yield* loadCodingExecutionFixture(options.fixtureId)
      const temporaryDirectory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: `effect-dsp-execution-${resolved.fixture.fixtureId}-`
      }).pipe(
        Effect.mapError(() =>
          new CodingExecutionJudgeError({
            fixtureId: resolved.fixture.fixtureId,
            message: "failed to allocate temp repo"
          })
        )
      )
      const repoRoot = path.join(temporaryDirectory, resolved.fixture.fixtureId)

      yield* fileSystem.copy(resolved.repoRoot, repoRoot).pipe(
        Effect.mapError(() =>
          new CodingExecutionJudgeError({
            fixtureId: resolved.fixture.fixtureId,
            message: "failed to copy repo fixture"
          })
        )
      )

      const fileTouches = yield* (options.applyPatch
        ? applyPatchFiles(resolved.fixture, repoRoot)
        : Effect.succeed(Arr.empty<string>()))
      const runs = yield* Effect.forEach(
        resolved.fixture.runManifest,
        (entry) => runManifestEntry(repoRoot, entry),
        { concurrency: 1 }
      )
      const allPassed = options.applyPatch && Arr.every(runs, (run) => run.passed)
      const score = scoreFrom(options.applyPatch, runs)

      return new CodingExecutionJudgeResult({
        fixtureId: resolved.fixture.fixtureId,
        sourceThreadId: resolved.fixture.sourceThreadId,
        patchApplied: options.applyPatch,
        allPassed,
        score,
        fileTouches,
        runs,
        feedback: feedbackFrom(options.applyPatch, runs)
      })
    })
  )
