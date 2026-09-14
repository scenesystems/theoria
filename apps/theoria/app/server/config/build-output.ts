import { FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Effect, Either, identity, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"

import { type WebVitalBudgets, webVitalBudgets } from "../../contracts/performance.js"
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
  workerBytes: Schema.Number,
  homepageScriptGzipBytes: Schema.Number
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

const isNotFound = (error: PlatformError): boolean => error._tag === "SystemError" && error.reason === "NotFound"

/**
 * The bytes on the wire for a file served gzip-encoded, from the platform's
 * own `CompressionStream`, so the check needs no Node module and measures
 * what the browser receives. Compression of bytes cannot fail; if it does,
 * the check itself is broken, which is a defect, not a build problem.
 */
export const gzipBytes = (bytes: Uint8Array): Effect.Effect<number> =>
  Stream.fromReadableStream({
    // A fresh copy: the file's view may be over a shared buffer, and the compressor takes only an `ArrayBuffer`-backed one.
    evaluate: () =>
      Stream.toReadableStream(Stream.make(new Uint8Array(bytes))).pipeThrough(new CompressionStream("gzip")),
    onError: identity
  }).pipe(
    Stream.runFold(0, (total, chunk) => total + chunk.byteLength),
    Effect.orDie
  )

/** Module entry and modulepreload JavaScript paths loaded by the homepage, in document order. */
export const homepageScripts = (indexHtml: string): ReadonlyArray<string> =>
  Arr.dedupe(
    Arr.filterMap(
      Arr.fromIterable(indexHtml.matchAll(
        /<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>|<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*\bhref=["'](\/assets\/[^"']+\.js)["'][^>]*>/giu
      )),
      (match) => Option.fromNullable(match[1] ?? match[2])
    )
  )

/**
 * Every problem is collected before failing so one run reports the whole build.
 * A file that is absent is a build problem; a filesystem that cannot be
 * examined is a failure of the check itself and propagates as `PlatformError`.
 */
export const checkBuildOutput = (
  root: string,
  budgets: WebVitalBudgets = webVitalBudgets
): Effect.Effect<BuildOutputSummary, BuildOutputError | PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // `stat` follows links, so an entry is first checked to be exactly where
    // it appears: its canonical path must be its path under the canonical
    // root. A link into or out of the artifact resolves elsewhere and must
    // never pass as the regular file it points at. Only an absent entry is
    // a verdict; any other filesystem failure fails the check itself.
    const canonicalRoot = yield* fileSystem.realPath(root)
    const kindOf = (relativePath: string): Effect.Effect<Option.Option<FileSystem.File.Type>, PlatformError> =>
      Effect.gen(function*() {
        const absolute = path.join(root, relativePath)
        const canonical = yield* fileSystem.realPath(absolute)
        if (canonical !== path.join(canonicalRoot, relativePath)) {
          return Option.some<FileSystem.File.Type>("SymbolicLink")
        }
        const info = yield* fileSystem.stat(absolute)
        return Option.some(info.type)
      }).pipe(Effect.catchIf(isNotFound, () => Effect.succeedNone))

    const required = yield* Effect.forEach(
      requiredBuildFiles,
      (file) => Effect.map(kindOf(file), (kind) => ({ file, kind }))
    )
    const missing: ReadonlyArray<string> = Arr.filterMap(
      required,
      ({ file, kind }) =>
        Option.exists(kind, (type) => type === "File")
          ? Option.none()
          : Option.some(`${file}: missing`)
    )

    const listed = yield* Effect.forEach(
      buildDirectories,
      (directory) =>
        fileSystem.readDirectory(path.join(root, directory), { recursive: true }).pipe(
          Effect.map((entries) => Either.right(Arr.map(entries, (entry) => `${directory}/${entry}`))),
          Effect.catchIf(isNotFound, () => Effect.succeed(Either.left(`${directory}/: missing directory`)))
        )
    )
    const entries: ReadonlyArray<string> = Arr.flatten(Arr.getRights(listed))
    const kinds = yield* Effect.forEach(entries, (entry) => Effect.map(kindOf(entry), (kind) => ({ entry, kind })))
    const entryProblems: ReadonlyArray<string> = Arr.filterMap(kinds, ({ entry, kind }) =>
      Option.match(kind, {
        onNone: () => Option.some(`${entry}: vanished during the check`),
        onSome: (type) => fileProblem(entry, type)
      }))
    const existingProblems: ReadonlyArray<string> = [...missing, ...Arr.getLefts(listed), ...entryProblems]
    const scriptResults = Arr.isEmptyReadonlyArray(existingProblems)
      ? yield* Effect.flatMap(
        fileSystem.readFileString(path.join(root, "dist/index.html")),
        (indexHtml) =>
          Effect.forEach(
            homepageScripts(indexHtml),
            (script) =>
              fileSystem.readFile(path.join(root, `dist${script}`)).pipe(
                Effect.flatMap(gzipBytes),
                Effect.map(Either.right),
                Effect.catchIf(
                  isNotFound,
                  () => Effect.succeed(Either.left(`dist${script}: named by dist/index.html but missing`))
                )
              )
          )
      )
      : Arr.empty<Either.Either<number, string>>()
    const homepageScriptGzipBytes = Arr.reduce(Arr.getRights(scriptResults), 0, (total, bytes) => total + bytes)
    const scriptProblems = Arr.getLefts(scriptResults)
    const budgetProblems = homepageScriptGzipBytes > budgets.homepageScriptGzipBytes
      ? [
        `dist/index.html: homepage scripts are ${String(homepageScriptGzipBytes)} gzip bytes, over the budget of ${
          String(budgets.homepageScriptGzipBytes)
        }`
      ]
      : Arr.empty<string>()
    const problems: ReadonlyArray<string> = [...existingProblems, ...scriptProblems, ...budgetProblems]
    if (Arr.isNonEmptyReadonlyArray(problems)) return yield* new BuildOutputError({ root, problems })

    const worker = yield* fileSystem.stat(path.join(root, ".wrangler-out/worker.js"))
    const assets = Arr.filter(kinds, ({ entry, kind }) =>
      entry.startsWith("dist/") && Option.exists(kind, (type) =>
        type === "File")).length
    return { root, assets, workerBytes: Number(worker.size), homepageScriptGzipBytes }
  })
