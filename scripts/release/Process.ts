/** Subprocess output whose success includes the exit status, not just readable stdout. */
import { Array, Boolean, Effect, Number, Schema, Stream } from "effect"
import type { ChildProcess } from "effect/process"

export class CommandFailed
  extends Schema.TaggedError<CommandFailed>("@theoria/scripts/release/Process/CommandFailed")("CommandFailed", {
    message: Schema.String,
    exitCode: Schema.Finite
  })
{}

export const output = (command: ChildProcess.Command) =>
  Effect.gen(function*() {
    const running = yield* command
    const text = yield* running.stdout.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(Array.join("")))
    const exitCode = yield* running.exitCode
    yield* Effect.when(
      new CommandFailed({ message: "Release command failed", exitCode }),
      Effect.sync(() => Boolean.not(Number.Equivalence(exitCode, 0)))
    )
    return text
  }).pipe(Effect.scoped)
