import { FileSystem, Path } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { BigInt, Boolean as Bool, Effect, Either, Equal, identity, Match, Option, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Str from "effect/String"

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
export class BuildOutputError
  extends Schema.TaggedError<BuildOutputError>("@theoria/app/server/config/BuildOutputError")("BuildOutputError", {
    root: Schema.String,
    problems: Schema.Array(Schema.String)
  })
{
  override get message(): string {
    return `Build output in ${this.root} is not deployable:\n${
      Arr.join(Arr.map(this.problems, (problem) => `  - ${problem}`), "\n")
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
  return Match.value(relativePath).pipe(
    Match.when("dist/_headers", () => Option.none()),
    Match.when(Str.startsWith("dist/"), (path) =>
      Bool.match(Option.isSome(contentTypeForPath(path)), {
        onTrue: Option.none,
        onFalse: () => Option.some(`${path}: the server has no content type for this file`)
      })),
    Match.when(Str.startsWith(".wrangler-out/"), (path) => {
      const name = Str.slice(Str.length(".wrangler-out/"))(path)
      return Bool.match(
        Bool.or(
          Arr.contains(workerFiles, name),
          Bool.and(Str.endsWith(".wasm")(name), Bool.not(Str.includes("/")(name)))
        ),
        {
          onTrue: Option.none,
          onFalse: () => Option.some(`${path}: only the Worker bundle, its source map, README and wasm modules ship`)
        }
      )
    }),
    Match.orElse((path) => Option.some(`${path}: outside dist/ and .wrangler-out/`))
  )
}

const fileProblem = (entry: string, type: FileSystem.File.Type): Option.Option<string> =>
  Match.value(type).pipe(
    Match.when("File", () => buildFileProblem(entry)),
    Match.when("Directory", () => Option.none<string>()),
    Match.orElse((other) => Option.some(`${entry}: is a ${other}, not a regular file`))
  )

const isNotFound = (error: PlatformError): boolean =>
  Match.value(error).pipe(
    Match.tag("SystemError", ({ reason }) => Equal.equals(reason, "NotFound")),
    Match.orElse(() => false)
  )

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
    Stream.runFold(0, (total, chunk) => Num.sum(total, chunk.byteLength)),
    Effect.orDie
  )

/** Module entry and modulepreload JavaScript paths loaded by the homepage, in document order. */
export const homepageScripts = (indexHtml: string): ReadonlyArray<string> =>
  Arr.dedupe(
    Arr.filterMap(
      Arr.fromIterable(
        Str.matchAll(
          /<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>|<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*\bhref=["'](\/assets\/[^"']+\.js)["'][^>]*>/giu
        )(indexHtml)
      ),
      (match) => Option.orElse(Option.fromNullable(match[1]), () => Option.fromNullable(match[2]))
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
        return yield* Bool.match(Bool.not(Equal.equals(canonical, path.join(canonicalRoot, relativePath))), {
          onTrue: () => Effect.succeedSome<FileSystem.File.Type>("SymbolicLink"),
          onFalse: () => Effect.map(fileSystem.stat(absolute), (info) => Option.some(info.type))
        })
      }).pipe(Effect.catchIf(isNotFound, () => Effect.succeedNone))

    const required = yield* Effect.forEach(
      requiredBuildFiles,
      (file) => Effect.map(kindOf(file), (kind) => ({ file, kind }))
    )
    const missing: ReadonlyArray<string> = Arr.filterMap(
      required,
      ({ file, kind }) =>
        Bool.match(Option.exists(kind, (type) => Equal.equals(type, "File")), {
          onTrue: Option.none,
          onFalse: () => Option.some(`${file}: missing`)
        })
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
    const existingProblems: ReadonlyArray<string> = Arr.appendAll(
      Arr.appendAll(missing, Arr.getLefts(listed)),
      entryProblems
    )
    const scriptResults = yield* Bool.match(Arr.isEmptyReadonlyArray(existingProblems), {
      onTrue: () =>
        Effect.flatMap(
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
        ),
      onFalse: () => Effect.succeed(Arr.empty<Either.Either<number, string>>())
    })
    const homepageScriptGzipBytes = Arr.reduce(Arr.getRights(scriptResults), 0, Num.sum)
    const scriptProblems = Arr.getLefts(scriptResults)
    const budgetProblems = Bool.match(Num.greaterThan(homepageScriptGzipBytes, budgets.homepageScriptGzipBytes), {
      onTrue: () => [
        `dist/index.html: homepage scripts are ${String(homepageScriptGzipBytes)} gzip bytes, over the budget of ${
          String(budgets.homepageScriptGzipBytes)
        }`
      ],
      onFalse: () => Arr.empty<string>()
    })
    const problems: ReadonlyArray<string> = Arr.appendAll(
      Arr.appendAll(existingProblems, scriptProblems),
      budgetProblems
    )
    yield* Effect.when(
      Effect.fail(new BuildOutputError({ root, problems })),
      () => Arr.isNonEmptyReadonlyArray(problems)
    )

    const worker = yield* fileSystem.stat(path.join(root, ".wrangler-out/worker.js"))
    const assets = Arr.length(
      Arr.filter(kinds, ({ entry, kind }) =>
        Bool.and(
          Str.startsWith("dist/")(entry),
          Option.exists(kind, (type) => Equal.equals(type, "File"))
        ))
    )
    return { root, assets, workerBytes: Option.getOrThrow(BigInt.toNumber(worker.size)), homepageScriptGzipBytes }
  })
