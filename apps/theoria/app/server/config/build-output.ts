import { FileSystem, Path } from "@effect/platform"
import { Effect, Option, Schema } from "effect"
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

export interface BuildOutputSummary {
  readonly root: string
  readonly assets: number
  readonly workerBytes: number
}

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

export const checkBuildOutput = (
  root: string
): Effect.Effect<BuildOutputSummary, BuildOutputError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const fail = (problems: ReadonlyArray<string>) => new BuildOutputError({ root, problems })

    const isFile = (relativePath: string) =>
      fileSystem.stat(path.join(root, relativePath)).pipe(
        Effect.map((info) => info.type === "File"),
        Effect.orElseSucceed(() => false)
      )
    const missing = yield* Effect.filter(requiredBuildFiles, (file) => Effect.map(isFile(file), (present) => !present))
    if (Arr.isNonEmptyReadonlyArray(missing)) {
      return yield* fail(Arr.map(missing, (file) => `${file}: missing`))
    }

    const entries = yield* Effect.forEach(buildDirectories, (directory) =>
      fileSystem.readDirectory(path.join(root, directory), { recursive: true }).pipe(
        Effect.map(Arr.map((entry) =>
          `${directory}/${entry}`
        ))
      )).pipe(
        Effect.map(Arr.flatten),
        Effect.mapError((cause) => fail([String(cause)]))
      )
    const files = yield* Effect.forEach(entries, (entry) =>
      fileSystem.stat(path.join(root, entry)).pipe(
        Effect.map((info) => ({ entry, type: info.type }))
      )).pipe(Effect.mapError((cause) => fail([String(cause)])))
    const problems = Arr.filterMap(files, (file) => fileProblem(file.entry, file.type))
    if (Arr.isNonEmptyReadonlyArray(problems)) return yield* fail(problems)

    const worker = yield* fileSystem.stat(path.join(root, ".wrangler-out/worker.js")).pipe(
      Effect.mapError((cause) => fail([String(cause)]))
    )
    const assets = Arr.filter(files, (file) => file.type === "File" && file.entry.startsWith("dist/")).length
    return { root, assets, workerBytes: Number(worker.size) }
  })
