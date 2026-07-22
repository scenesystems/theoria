import { Command, FileSystem } from "@effect/platform"
import { Array as Arr, Effect, Schema, Stream } from "effect"

export class CryptoReleaseCheckError extends Schema.TaggedError<CryptoReleaseCheckError>()(
  "CryptoReleaseCheckError",
  {
    stage: Schema.NonEmptyString,
    detail: Schema.NonEmptyString
  }
) {}

const boundedDetail = (detail: string): string => {
  const trimmed = detail.trim()
  return trimmed.length === 0 ? "command failed without diagnostic output" : trimmed.slice(0, 2_000)
}

export const runCommandExit = (
  cwd: string,
  executable: string,
  args: ReadonlyArray<string>
) =>
  Effect.scoped(
    Effect.gen(function*() {
      const command = Command.make(executable, ...args).pipe(
        Command.workingDirectory(cwd),
        Command.stdout("pipe"),
        Command.stderr("pipe")
      )
      const process = yield* Command.start(command).pipe(
        Effect.mapError(() =>
          new CryptoReleaseCheckError({ stage: "start-command", detail: `${executable} could not be started` })
        )
      )
      const [exitCode, stdout, stderr] = yield* Effect.all(
        [
          process.exitCode,
          Stream.decodeText(process.stdout).pipe(Stream.runFold("", (output, chunk) => `${output}${chunk}`)),
          Stream.decodeText(process.stderr).pipe(Stream.runFold("", (output, chunk) => `${output}${chunk}`))
        ],
        { concurrency: "unbounded" }
      ).pipe(
        Effect.mapError(() =>
          new CryptoReleaseCheckError({ stage: "run-command", detail: `${executable} execution failed` })
        )
      )

      return { exitCode: Number(exitCode), stdout, stderr }
    })
  )

export const runCommand = (
  stage: string,
  cwd: string,
  executable: string,
  args: ReadonlyArray<string>
) =>
  Effect.flatMap(runCommandExit(cwd, executable, args), (result) =>
    result.exitCode === 0
      ? Effect.succeed(result.stdout.trim())
      : Effect.fail(
        new CryptoReleaseCheckError({
          stage,
          detail: boundedDetail(result.stderr.length > 0 ? result.stderr : result.stdout)
        })
      ))

export const sha256Hex = (bytes: Uint8Array): Effect.Effect<string> =>
  Effect.sync(() => new Bun.CryptoHasher("sha256").update(bytes).digest("hex"))

export const readSha256Hex = (filePath: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fileSystem) => fileSystem.readFile(filePath)),
    Effect.flatMap(sha256Hex),
    Effect.mapError(() => new CryptoReleaseCheckError({ stage: "hash-file", detail: filePath }))
  )

const Sha256Hex = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const GitSha = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{40}$/))

export const CryptoReleaseEvidence = Schema.Struct({
  format: Schema.Literal("theoria-crypto-release-evidence-v1"),
  packageName: Schema.NonEmptyString,
  gitCommit: GitSha,
  workingTree: Schema.Literal("clean", "dirty"),
  lockfileSha256: Sha256Hex,
  provider: Schema.Struct({
    name: Schema.NonEmptyString,
    version: Schema.NonEmptyString,
    npmSri: Schema.NonEmptyString,
    sourceRepository: Schema.String.pipe(Schema.pattern(/^https:\/\//)),
    sourceRevision: GitSha
  }),
  fixtures: Schema.NonEmptyArray(
    Schema.Struct({
      id: Schema.NonEmptyString,
      revision: Schema.NonEmptyString,
      fixturePath: Schema.NonEmptyString,
      contentSha256: Sha256Hex
    })
  ),
  runtimes: Schema.Struct({
    node: Schema.NonEmptyString,
    bun: Schema.NonEmptyString,
    chromium: Schema.NonEmptyString,
    playwright: Schema.NonEmptyString
  }),
  tarballSha256: Sha256Hex,
  katIds: Schema.NonEmptyArray(Schema.NonEmptyString),
  verdicts: Schema.Struct({
    esm: Schema.Literal("pass"),
    cjs: Schema.Literal("pass"),
    node: Schema.Literal("pass"),
    bun: Schema.Literal("pass"),
    browser: Schema.Literal("pass"),
    internalExports: Schema.Literal("denied"),
    publicDeclarations: Schema.Literal("provider-types-absent")
  })
})

export const CryptoReleaseEvidenceJson = Schema.parseJson(CryptoReleaseEvidence)

export const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && Arr.every(Arr.zip(left, right), ([leftValue, rightValue]) => leftValue === rightValue)
