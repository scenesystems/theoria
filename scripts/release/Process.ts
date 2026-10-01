/** Subprocess output whose success includes the exit status, not just readable stdout. */
import { Command } from "@effect/platform"
import { Effect, Number, Schema, Sink, Stream } from "effect"

export class CommandFailed extends Schema.TaggedError<CommandFailed>(
  "@theoria/scripts/release/Process/CommandFailed"
)("CommandFailed", { message: Schema.String, exitCode: Schema.Number }) {}

export const output = (command: Command.Command) =>
  Effect.gen(function*() {
    const running = yield* Command.start(command.pipe(Command.stderr("inherit")))
    const text = yield* Stream.run(Stream.decodeText(running.stdout), Sink.mkString)
    const exitCode = yield* running.exitCode
    yield* Effect.unless(new CommandFailed({ message: "Release command failed", exitCode }), () =>
      Number.Equivalence(exitCode, 0))
    return text
  }).pipe(Effect.scoped)
