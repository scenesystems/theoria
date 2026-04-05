/**
 * Verifies canonical README TypeScript examples by extracting explicitly marked
 * fenced blocks and compiling them in-place next to their source README.
 */

import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Data, Effect, Stream } from "effect"
import type { Scope } from "effect"

class ReadmeExampleCheckError extends Data.TaggedError("ReadmeExampleCheckError")<{
  readonly message: string
  readonly exitCode: number
}> {}

type SnippetLanguage = "ts" | "tsx"

type ReadmeTarget = {
  readonly absolutePath: string
  readonly relativePath: string
}

type ReadmeSnippet = {
  readonly readme: ReadmeTarget
  readonly code: string
  readonly language: SnippetLanguage
  readonly line: number
}

type TempSnippet = ReadmeSnippet & {
  readonly tempPath: string
}

const rootUrl = new URL("../", import.meta.url)
const TYPECHECK_TOKEN = "typecheck"

const toPosixPath = (pathService: Path.Path, value: string): string =>
  value.split(pathService.sep).join("/")

const resolveProjectRoot = Effect.gen(function*() {
  const pathService = yield* Path.Path

  return yield* pathService.fromFileUrl(rootUrl).pipe(Effect.orDie)
})

const supportedLanguage = (token: string | undefined): SnippetLanguage | undefined => {
  if (token === "ts" || token === "typescript") {
    return "ts"
  }

  if (token === "tsx") {
    return "tsx"
  }

  return undefined
}

const listWorkspaceReadmes = (root: string, directoryName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const workspaceRoot = pathService.join(root, directoryName)
    const exists = yield* fileSystem.exists(workspaceRoot).pipe(Effect.orDie)

    if (!exists) {
      return Arr.empty<ReadmeTarget>()
    }

    const entries = yield* fileSystem.readDirectory(workspaceRoot).pipe(Effect.orDie)

    const discovered = yield* Effect.forEach(
      entries,
      (entry) =>
        Effect.gen(function*() {
          const entryPath = pathService.join(workspaceRoot, entry)
          const stat = yield* fileSystem.stat(entryPath).pipe(Effect.orDie)

          if (stat.type !== "Directory") {
            return undefined
          }

          const readmePath = pathService.join(entryPath, "README.md")
          const hasReadme = yield* fileSystem.exists(readmePath).pipe(Effect.orDie)

          if (!hasReadme) {
            return undefined
          }

          return {
            absolutePath: readmePath,
            relativePath: toPosixPath(pathService, pathService.relative(root, readmePath))
          } satisfies ReadmeTarget
        }),
      { concurrency: "unbounded" }
    )

    return discovered.filter((entry): entry is ReadmeTarget => entry !== undefined)
  })

const listReadmeTargets = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path
  const root = yield* resolveProjectRoot
  const rootReadme = pathService.join(root, "README.md")
  const targets = yield* Effect.all(
    [listWorkspaceReadmes(root, "packages"), listWorkspaceReadmes(root, "apps")],
    { concurrency: "unbounded" }
  )

  const rootTarget = yield* fileSystem.exists(rootReadme).pipe(
    Effect.orDie,
    Effect.map((exists) =>
      exists
        ? [{ absolutePath: rootReadme, relativePath: "README.md" } satisfies ReadmeTarget]
        : Arr.empty<ReadmeTarget>()
    )
  )

  return [
    ...rootTarget,
    ...targets[0],
    ...targets[1]
  ]
})

const parseReadmeSnippets = (
  readme: ReadmeTarget,
  content: string
): Effect.Effect<ReadonlyArray<ReadmeSnippet>, ReadmeExampleCheckError> =>
  Effect.gen(function*() {
    const lines = content.split("\n")
    const snippets: Array<ReadmeSnippet> = []
    let index = 0

    while (index < lines.length) {
      const currentLine = lines[index] ?? ""

      if (!currentLine.startsWith("```")) {
        index += 1
        continue
      }

      const info = currentLine.slice(3).trim().toLowerCase()
      const tokens = info.split(/\s+/).filter((token) => token.length > 0)
      const language = supportedLanguage(tokens[0])
      const shouldTypecheck = tokens.includes(TYPECHECK_TOKEN)
      const startLine = index + 1

      index += 1
      const body: Array<string> = []

      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        body.push(lines[index] ?? "")
        index += 1
      }

      if (index >= lines.length) {
        return yield* Effect.fail(
          new ReadmeExampleCheckError({
            message: `Unclosed code fence in ${readme.relativePath}:${String(startLine)}`,
            exitCode: 1
          })
        )
      }

      if (language !== undefined && shouldTypecheck) {
        snippets.push({
          readme,
          code: `${body.join("\n")}\n`,
          language,
          line: startLine + 1
        })
      }

      index += 1
    }

    return snippets
  })

const loadReadmeSnippets = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const targets = yield* listReadmeTargets

  const snippets = yield* Effect.forEach(
    targets,
    (readme) =>
      fileSystem.readFileString(readme.absolutePath).pipe(
        Effect.orDie,
        Effect.flatMap((content) => parseReadmeSnippets(readme, content))
      ),
    { concurrency: "unbounded" }
  )

  return Arr.flatten(snippets)
})

const materializeSnippet = (snippet: ReadmeSnippet): Effect.Effect<TempSnippet, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const readmeDirectory = pathService.dirname(snippet.readme.absolutePath)
    const tempPath = yield* fileSystem.makeTempFileScoped({
      directory: readmeDirectory,
      prefix: ".readme-typecheck-",
      suffix: snippet.language === "tsx" ? ".tsx" : ".ts"
    }).pipe(Effect.orDie)

    const header = `// Extracted from ${snippet.readme.relativePath}:${String(snippet.line)}\n`
    yield* fileSystem.writeFileString(tempPath, `${header}${snippet.code}`).pipe(Effect.orDie)

    return {
      ...snippet,
      tempPath
    }
  })

const rewriteCompilerOutput = (output: string, snippets: ReadonlyArray<TempSnippet>): string =>
  snippets.reduce(
    (current, snippet) => current.replaceAll(snippet.tempPath, `${snippet.readme.relativePath}:${String(snippet.line)}`),
    output
  )

const runCompiler = (root: string, snippets: ReadonlyArray<TempSnippet>) =>
  Effect.gen(function*() {
    if (snippets.length === 0) {
      return
    }

    const command = Command.make(
      "bunx",
      "tsc",
      "--noEmit",
      "--pretty",
      "false",
      "--allowJs",
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2022",
      "--lib",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--moduleDetection",
      "force",
      "--verbatimModuleSyntax",
      "--isolatedModules",
      "--resolveJsonModule",
      "--exactOptionalPropertyTypes",
      "--noFallthroughCasesInSwitch",
      "--noUncheckedIndexedAccess",
      "--noImplicitOverride",
      "--jsx",
      "react-jsx",
      ...snippets.map((snippet) => snippet.tempPath)
    ).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )

    const running = yield* Command.start(command)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [
        running.exitCode,
        Stream.decodeText(running.stdout).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`)),
        Stream.decodeText(running.stderr).pipe(Stream.runFold("", (acc, chunk) => `${acc}${chunk}`))
      ],
      { concurrency: "unbounded" }
    )

    if (Number(exitCode) === 0) {
      return
    }

    const compilerOutput = rewriteCompilerOutput(`${stdout}${stderr}`, snippets).trim()

    return yield* Effect.fail(
      new ReadmeExampleCheckError({
        message: compilerOutput.length > 0
          ? compilerOutput
          : "README example typecheck failed with no compiler output",
        exitCode: Number(exitCode)
      })
    )
  }).pipe(Effect.scoped)

const summarizeByReadme = (snippets: ReadonlyArray<ReadmeSnippet>): ReadonlyArray<readonly [string, number]> => {
  const counts = new Map<string, number>()

  for (const snippet of snippets) {
    counts.set(snippet.readme.relativePath, (counts.get(snippet.readme.relativePath) ?? 0) + 1)
  }

  return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right))
}

const program = Effect.gen(function*() {
  const root = yield* resolveProjectRoot
  const snippets = yield* loadReadmeSnippets

  if (snippets.length === 0) {
    return yield* Effect.fail(
      new ReadmeExampleCheckError({
        message: "No README code fences marked with 'typecheck' were found.",
        exitCode: 1
      })
    )
  }

  const materialized = yield* Effect.forEach(snippets, materializeSnippet, { concurrency: "unbounded" })
  yield* runCompiler(root, materialized)

  yield* Console.log(`Verified ${String(snippets.length)} canonical README example${snippets.length === 1 ? "" : "s"}.`)

  const perReadme = summarizeByReadme(snippets)
  yield* Effect.forEach(
    perReadme,
    ([relativePath, count]) => Console.log(`- ${relativePath}: ${String(count)} snippet${count === 1 ? "" : "s"}`),
    { discard: true }
  )
}).pipe(Effect.scoped)

const main = program.pipe(
  Effect.catchTag("ReadmeExampleCheckError", (error) =>
    Console.error(error.message).pipe(
      Effect.andThen(Effect.sync(() => process.exit(error.exitCode)))
    )),
  Effect.provide(BunContext.layer)
)

BunRuntime.runMain(main)
