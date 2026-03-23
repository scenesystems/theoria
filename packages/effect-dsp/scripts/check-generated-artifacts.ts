import { BunRuntime } from "@effect/platform-bun"
import { Console, Data, Effect, Option } from "effect"

type Command = ReadonlyArray<string>

class GeneratedArtifactsError extends Data.TaggedError("GeneratedArtifactsError")<{
  readonly message: string
  readonly exitCode: number
}> {}

const toExitCode = (exitCode: number | null): number => Option.getOrElse(Option.fromNullable(exitCode), () => 1)

const spawnSync = (command: Command): Effect.Effect<Bun.SpawnSyncReturns<"inherit", "inherit">> =>
  Effect.sync(() =>
    Bun.spawnSync(command, {
      cwd: process.cwd(),
      stdout: "inherit",
      stderr: "inherit"
    })
  )

const runCommand = (label: string, command: Command): Effect.Effect<void, GeneratedArtifactsError> =>
  Effect.gen(function*() {
    const result = yield* spawnSync(command)

    if (result.exitCode === 0) {
      return
    }

    return yield* Effect.fail(
      new GeneratedArtifactsError({
        message: `[generated-artifacts] '${label}' failed`,
        exitCode: toExitCode(result.exitCode)
      })
    )
  })

const ensureCodegenIsCommitted = (): Effect.Effect<void, GeneratedArtifactsError> =>
  Effect.gen(function*() {
    const diff = yield* spawnSync(["git", "diff", "--exit-code", "src/index.ts"])

    if (diff.exitCode === 0) {
      return
    }

    return yield* Effect.fail(
      new GeneratedArtifactsError({
        message: "[generated-artifacts] src/index.ts is out of date. Run 'bun run codegen' and commit.",
        exitCode: 1
      })
    )
  })

const program = Effect.gen(function*() {
  yield* runCommand("codegen", ["bun", "run", "codegen"])
  yield* ensureCodegenIsCommitted()
  yield* runCommand("docgen", ["bun", "run", "docgen"])
  yield* runCommand("exports contract", ["bun", "run", "check:exports"])
})

const main = program.pipe(
  Effect.catchTag("GeneratedArtifactsError", (error) =>
    Console.error(error.message).pipe(
      Effect.andThen(Effect.sync(() => process.exit(error.exitCode)))
    ))
)

BunRuntime.runMain(main)
