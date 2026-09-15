/** Linux/Bun executable input for the release CLI. */
import { FileSystem, Path, Url } from "@effect/platform"
import { Array, Effect, Number, Schema, String } from "effect"

export class InvalidInvocation extends Schema.TaggedError<InvalidInvocation>()("InvalidInvocation", {
  message: Schema.String
}) {}

/** Preserve argument boundaries without a raw process/Bun global or a shell. */
export const read = (scriptUrl: string) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const script = yield* path.fromFileUrl(yield* Url.fromString(scriptUrl))
    const text = yield* fs.readFileString("/proc/self/cmdline").pipe(
      Effect.flatMap(Schema.decode(Schema.String.pipe(Schema.endsWith("\0"))))
    )
    const args = String.split(String.slice(0, -1)(text), "\0")
    const executable = Array.headNonEmpty(args)
    const index = yield* Array.findFirstIndex(args, (arg) => String.Equivalence(path.resolve(arg), script)).pipe(
      Effect.mapError(() =>
        new InvalidInvocation({ message: "The running script is absent from the process arguments." })
      )
    )
    return Array.prependAll(Array.drop(args, Number.increment(index)), Array.make(executable, script))
  })
