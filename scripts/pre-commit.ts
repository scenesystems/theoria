/** Runs the repository's staged-file checks and typecheck before a commit. */
import { Command } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array, Console, Effect, Number, Schema, Stream, String } from "effect"

class CommitCheckFailure
  extends Schema.TaggedError<CommitCheckFailure>("@theoria/scripts/pre-commit/CommitCheckFailure")(
    "CommitCheckFailure",
    {
      check: Schema.String,
      exitCode: Schema.Number
    }
  )
{}

const check = (name: string, command: Command.Command) =>
  command.pipe(
    Command.stdin("inherit"),
    Command.stdout("inherit"),
    Command.stderr("inherit"),
    Command.exitCode,
    Effect.filterOrFail(
      (exitCode) => Number.Equivalence(exitCode, 0),
      (exitCode) => new CommitCheckFailure({ check: name, exitCode })
    )
  )

const program = Effect.gen(function*() {
  yield* Console.log("Theoria Pre-commit Quality Checks")
  yield* Console.log("[1/3] Scanning staged files for secrets...")
  const git = yield* Command.make("git", "diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR").pipe(
    Command.stderr("inherit"),
    Command.start
  )
  const staged = yield* Effect.all({
    output: git.stdout.pipe(Stream.decodeText(), Stream.mkString),
    exitCode: git.exitCode
  }, { concurrency: "unbounded" }).pipe(
    Effect.filterOrFail(
      (result) => Number.Equivalence(result.exitCode, 0),
      (result) => new CommitCheckFailure({ check: "Read staged files", exitCode: result.exitCode })
    )
  )
  const files = Array.filter(String.split(staged.output, "\0"), String.isNonEmpty)
  yield* Effect.forEach(
    Array.chunksOf(files, 100),
    (batch) => check("Secrets scan", Command.make("bunx", "secretlint", "--no-terminalLink", "--no-glob", ...batch)),
    { discard: true }
  )
  yield* Console.log("Secrets scan passed")
  yield* Console.log("[2/3] Linting and formatting staged files...")
  yield* check("Lint and format", Command.make("bunx", "lint-staged", "--no-stash"))
  yield* Console.log("Lint and format passed")
  yield* Console.log("[3/3] Type checking (check:all)...")
  yield* check("Typecheck", Command.make("bun", "run", "check:all"))
  yield* Console.log("All pre-commit checks passed!")
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(BunContext.layer)))
