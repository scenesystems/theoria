import { FileSystem, Path } from "@effect/platform"
import { Effect, Either, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { contentTypeForPath } from "./static-store.js"

/**
 * What a Theoria build directory must contain before it is uploaded and again
 * before it is deployed: the Vite bundle in `dist/` and the pre-bundled Worker
 * in `.wrangler-out/`.
 *
 * The rule for `dist/` is derived, not listed: a file may ship only if the
 * server has a `content-type` for it (`contentTypeForPath`). Anything else
 * would be served incorrectly, so the build fails instead.
 */
export class BuildOutputError extends Schema.TaggedError<BuildOutputError>()("BuildOutputError", {
  root: Schema.String,
  problems: Schema.Array(Schema.String)
}) {
  override get message(): string {
    return `Build output in ${this.root} is not deployable:\n${
      this.problems.map((problem) => `  - ${problem}`).join("\n")
    }`
  }
}

export const BuildOutputSummary = Schema.Struct({
  root: Schema.String,
  assets: Schema.Number,
  workerBytes: Schema.Number
})
export type BuildOutputSummary = typeof BuildOutputSummary.Type

export const requiredBuildFiles: ReadonlyArray<string> = [
  "dist/index.html",
  "dist/_headers",
  "dist/robots.txt",
  "dist/docs-data/manifest.json",
  ".wrangler-out/worker.js"
]

const buildDirectories: ReadonlyArray<string> = ["dist", ".wrangler-out"]

/** Files wrangler emits next to the bundle; `worker.js.map` is dropped by the upload filter. */
const workerFiles: ReadonlyArray<string> = ["worker.js", "worker.js.map", "README.md"]

/** Why a file must not ship, or `None` when it belongs in the build. */
export const buildFileProblem = (relativePath: string): Option.Option<string> => {
  if (relativePath === "dist/_headers") return Option.none()
  if (relativePath.startsWith("dist/")) {
    return Option.isSome(contentTypeForPath(relativePath))
      ? Option.none()
      : Option.some(`${relativePath}: the server has no content type for this file`)
  }
  if (relativePath.startsWith(".wrangler-out/")) {
    const name = relativePath.slice(".wrangler-out/".length)
    return Arr.contains(workerFiles, name) || (name.endsWith(".wasm") && !name.includes("/"))
      ? Option.none()
      : Option.some(`${relativePath}: only the Worker bundle, its source map, README and wasm modules ship`)
  }
  return Option.some(`${relativePath}: outside dist/ and .wrangler-out/`)
}

const fileProblem = (entry: string, type: FileSystem.File.Type): Option.Option<string> => {
  if (type === "File") return buildFileProblem(entry)
  if (type === "Directory") return Option.none()
  return Option.some(`${entry}: is a ${type}, not a regular file`)
}

/** Every problem is collected before failing so one run reports the whole build. */
export const checkBuildOutput = (
  root: string
): Effect.Effect<BuildOutputSummary, BuildOutputError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // `stat` follows links, so a link is detected first: a link into or out of
    // the artifact must never pass as the regular file it points at.
    const kindOf = (relativePath: string): Effect.Effect<Option.Option<FileSystem.File.Type>> =>
      fileSystem.readLink(path.join(root, relativePath)).pipe(
        Effect.as<FileSystem.File.Type>("SymbolicLink"),
        Effect.orElse(() => Effect.map(fileSystem.stat(path.join(root, relativePath)), (info) => info.type)),
        Effect.option
      )

    const required = yield* Effect.forEach(requiredBuildFiles, (file) =>
      Effect.map(kindOf(file), (kind) => ({ file, kind })))
    const missing: ReadonlyArray<string> = Arr.filterMap(required, ({ file, kind }) =>
      Option.exists(kind, (type) =>
          type === "File")
        ? Option.none()
        : Option.some(`${file}: missing`))

    const listed = yield* Effect.forEach(buildDirectories, (directory) =>
      fileSystem.readDirectory(path.join(root, directory), { recursive: true }).pipe(
        Effect.map((entries) =>
          Either.right(Arr.map(entries, (entry) =>
            `${directory}/${entry}`))
        ),
        Effect.orElseSucceed(() =>
          Either.left(`${directory}/: missing directory`)
        )
      ))
    const entries: ReadonlyArray<string> = Arr.flatten(Arr.getRights(listed))
    const kinds = yield* Effect.forEach(entries, (entry) =>
      Effect.map(kindOf(entry), (kind) => ({ entry, kind })))
    const entryProblems: ReadonlyArray<string> = Arr.filterMap(kinds, ({ entry, kind }) =>
      Option.match(kind, {
        onNone: () => Option.some(`${entry}: vanished during the check`),
        onSome: (type) => fileProblem(entry, type)
      }))
    const problems: ReadonlyArray<string> = [...missing, ...Arr.getLefts(listed), ...entryProblems]
    if (Arr.isNonEmptyReadonlyArray(problems)) return yield* new BuildOutputError({ root, problems })

    const worker = yield* fileSystem.stat(path.join(root, ".wrangler-out/worker.js")).pipe(
      Effect.mapError((cause) => new BuildOutputError({ root, problems: [String(cause)] }))
    )
    const assets = Arr.filter(kinds, ({ entry, kind }) =>
      entry.startsWith("dist/") && Option.exists(kind, (type) => type === "File")).length
    return { root, assets, workerBytes: Number(worker.size) }
  })
