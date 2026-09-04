/**
 * Discovers README files across the workspace and extracts fenced code blocks
 * marked `typecheck` for compilation.
 */

import { FileSystem, Path, Url } from "@effect/platform"
import { Array as Arr, Data, Effect, Match, Option, String as Str } from "effect"

export class ReadmeExampleCheckError extends Data.TaggedError("ReadmeExampleCheckError")<{
  readonly message: string
}> {}

type SnippetLanguage = "ts" | "tsx"

export class ReadmeTarget extends Data.Class<{
  readonly absolutePath: string
  readonly relativePath: string
}> {}

export class ReadmeSnippet extends Data.Class<{
  readonly readme: ReadmeTarget
  readonly code: string
  readonly language: SnippetLanguage
  readonly line: number
}> {}

class OpenFence extends Data.Class<{
  readonly startLine: number
  readonly language: Option.Option<SnippetLanguage>
  readonly typecheck: boolean
  readonly body: ReadonlyArray<string>
}> {}

class ParseState extends Data.Class<{
  readonly snippets: ReadonlyArray<ReadmeSnippet>
  readonly open: Option.Option<OpenFence>
}> {}

const FENCE = "```"
const TYPECHECK_TOKEN = "typecheck"

const toPosixPath = (pathService: Path.Path, value: string): string => value.split(pathService.sep).join("/")

export const projectRoot = Effect.gen(function*() {
  const pathService = yield* Path.Path
  const rootUrl = yield* Url.fromString("../../", import.meta.url)
  return yield* pathService.fromFileUrl(rootUrl)
}).pipe(Effect.orDie)

const supportedLanguage = (token: Option.Option<string>): Option.Option<SnippetLanguage> =>
  Option.flatMap(token, (value) =>
    Match.value(value).pipe(
      Match.when("ts", (): Option.Option<SnippetLanguage> => Option.some("ts")),
      Match.when("typescript", (): Option.Option<SnippetLanguage> => Option.some("ts")),
      Match.when("tsx", (): Option.Option<SnippetLanguage> => Option.some("tsx")),
      Match.orElse(() => Option.none())
    ))

const readmeTarget = (root: string, pathService: Path.Path, absolutePath: string): ReadmeTarget =>
  new ReadmeTarget({ absolutePath, relativePath: toPosixPath(pathService, pathService.relative(root, absolutePath)) })

const existingReadme = (root: string, directory: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const readmePath = pathService.join(directory, "README.md")
    const exists = yield* fileSystem.exists(readmePath).pipe(Effect.orDie)
    return exists ? Option.some(readmeTarget(root, pathService, readmePath)) : Option.none()
  })

const listWorkspaceReadmes = (root: string, directoryName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const workspaceRoot = pathService.join(root, directoryName)
    const exists = yield* fileSystem.exists(workspaceRoot).pipe(Effect.orDie)
    if (!exists) return Arr.empty<ReadmeTarget>()
    const entries = yield* fileSystem.readDirectory(workspaceRoot).pipe(Effect.orDie)
    const directories = yield* Effect.filter(
      entries,
      (entry) =>
        fileSystem.stat(pathService.join(workspaceRoot, entry)).pipe(
          Effect.orDie,
          Effect.map((stat) => stat.type === "Directory")
        )
    )
    const readmes = yield* Effect.forEach(
      directories,
      (entry) => existingReadme(root, pathService.join(workspaceRoot, entry)),
      { concurrency: "unbounded" }
    )
    return Arr.getSomes(readmes)
  })

const listReadmeTargets = Effect.gen(function*() {
  const root = yield* projectRoot
  const [rootReadme, packageReadmes, appReadmes] = yield* Effect.all(
    [existingReadme(root, root), listWorkspaceReadmes(root, "packages"), listWorkspaceReadmes(root, "apps")],
    { concurrency: "unbounded" }
  )
  return Arr.appendAll(Arr.appendAll(Arr.fromOption(rootReadme), packageReadmes), appReadmes)
})

const openFence = (line: string, index: number): OpenFence => {
  const tokens = Arr.filter(line.slice(FENCE.length).trim().toLowerCase().split(/\s+/), Str.isNonEmpty)
  return new OpenFence({
    startLine: index + 1,
    language: supportedLanguage(Arr.head(tokens)),
    typecheck: Arr.contains(tokens, TYPECHECK_TOKEN),
    body: Arr.empty()
  })
}

const closeFence = (readme: ReadmeTarget, state: ParseState, fence: OpenFence): ParseState =>
  new ParseState({
    open: Option.none(),
    snippets: Option.match(Option.filter(fence.language, () => fence.typecheck), {
      onNone: () => state.snippets,
      onSome: (language) =>
        Arr.append(
          state.snippets,
          new ReadmeSnippet({ readme, language, code: `${fence.body.join("\n")}\n`, line: fence.startLine + 1 })
        )
    })
  })

const parseReadmeSnippets = (
  readme: ReadmeTarget,
  content: string
): Effect.Effect<ReadonlyArray<ReadmeSnippet>, ReadmeExampleCheckError> => {
  const initial = new ParseState({ snippets: Arr.empty(), open: Option.none() })
  const final = Arr.reduce(content.split("\n"), initial, (state, line, index) =>
    Option.match(state.open, {
      onNone: () =>
        line.startsWith(FENCE) ? new ParseState({ ...state, open: Option.some(openFence(line, index)) }) : state,
      onSome: (fence) =>
        line.startsWith(FENCE)
          ? closeFence(readme, state, fence)
          : new ParseState({
            ...state,
            open: Option.some(new OpenFence({ ...fence, body: Arr.append(fence.body, line) }))
          })
    }))
  return Option.match(final.open, {
    onNone: () => Effect.succeed(final.snippets),
    onSome: (fence) =>
      new ReadmeExampleCheckError({
        message: `Unclosed code fence in ${readme.relativePath}:${String(fence.startLine)}`
      })
  })
}

export const loadReadmeSnippets = Effect.gen(function*() {
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
