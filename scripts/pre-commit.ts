/** Runs the repository's staged-file checks and typecheck before a commit. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Array, Console, Effect, Number, Schema, Stream, String } from "effect"
import { ChildProcess } from "effect/process"

class CommitCheckFailure
  extends Schema.TaggedError<CommitCheckFailure>("@theoria/scripts/pre-commit/CommitCheckFailure")(
    "CommitCheckFailure",
    {
      check: Schema.String,
      exitCode: Schema.Int
    }
  )
{
  override get message(): string {
    return `${this.check} failed with exit code ${this.exitCode}`
  }
}

const check = Effect.fn(function*(name: string, command: string, args: ReadonlyArray<string>) {
  const child = yield* ChildProcess.make(command, args, { stdin: "inherit", stdout: "inherit", stderr: "inherit" })
  yield* child.exitCode.pipe(
    Effect.filterOrFail(
      (exitCode) => Number.Equivalence(exitCode, 0),
      (exitCode) => CommitCheckFailure.make({ check: name, exitCode })
    )
  )
})

const program = Effect.gen(function*() {
  yield* Console.log("Theoria Pre-commit Quality Checks")
  yield* Console.log("[1/3] Scanning staged files for secrets...")
  const git = yield* ChildProcess.make("git", ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], {
    stderr: "inherit"
  })
  const staged = yield* Effect.all({
    output: git.stdout.pipe(Stream.decodeText, Stream.mkString),
    exitCode: git.exitCode
  }, { concurrency: "unbounded" }).pipe(
    Effect.filterOrFail(
      (result) => Number.Equivalence(result.exitCode, 0),
      (result) => CommitCheckFailure.make({ check: "Read staged files", exitCode: result.exitCode })
    )
  )
  const files = Array.filter(String.split(staged.output, "\0"), String.isNonEmpty)
  yield* Effect.forEach(
    Array.chunksOf(files, 100),
    (batch) => check("Secrets scan", "bunx", ["secretlint", "--no-terminalLink", "--no-glob", ...batch]),
    { discard: true }
  )
  yield* Console.log("Secrets scan passed")
  yield* Console.log("[2/3] Linting and formatting staged files...")
  yield* check("Lint and format", "bunx", ["lint-staged", "--no-stash"])
  yield* Console.log("Lint and format passed")
  yield* Console.log("[3/3] Type checking (check:all)...")
  yield* check("Typecheck", "bun", ["run", "check:all"])
  yield* Console.log("All pre-commit checks passed!")
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(BunServices.layer)))
