/**
 * Discovers README files across the workspace and extracts fenced code blocks
 * marked `typecheck` for compilation.
 */

import { FileSystem, Path, Url } from "@effect/platform"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Match,
  Number as Num,
  Option,
  Schema,
  String as Str,
  Tuple
} from "effect"

import { SnippetLanguage } from "../typecheck/snippets.js"

export class ReadmeExampleCheckError
  extends Schema.TaggedError<ReadmeExampleCheckError>("@theoria/scripts/readme-examples/ReadmeExampleCheckError")(
    "ReadmeExampleCheckError",
    {
      message: Schema.String
    }
  )
{}

export class ReadmeTarget extends Schema.Class<ReadmeTarget>("@theoria/scripts/readme-examples/ReadmeTarget")({
  absolutePath: Schema.String,
  relativePath: Schema.String
}) {}

export class ReadmeSnippet extends Schema.Class<ReadmeSnippet>("@theoria/scripts/readme-examples/ReadmeSnippet")({
  readme: ReadmeTarget,
  code: Schema.String,
  language: SnippetLanguage,
  line: Schema.Number
}) {}

class OpenFence extends Schema.Class<OpenFence>("OpenFence")({
  startLine: Schema.Number,
  language: Schema.OptionFromSelf(SnippetLanguage),
  typecheck: Schema.Boolean,
  body: Schema.Array(Schema.String)
}) {}

class ParseState extends Schema.Class<ParseState>("ParseState")({
  snippets: Schema.Array(ReadmeSnippet),
  open: Schema.OptionFromSelf(OpenFence)
}) {}

const FENCE = "```"
const TYPECHECK_TOKEN = "typecheck"

const toPosixPath = (pathService: Path.Path, value: string): string => Arr.join(Str.split(value, pathService.sep), "/")

export const projectRoot = Effect.gen(function*() {
  const pathService = yield* Path.Path
  const rootUrl = yield* Url.fromString("../../", import.meta.url).pipe(Effect.orDie)
  return yield* pathService.fromFileUrl(rootUrl)
})

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
    const exists = yield* fileSystem.exists(readmePath)
    return Bool.match(exists, {
      onTrue: () => Option.some(readmeTarget(root, pathService, readmePath)),
      onFalse: () => Option.none()
    })
  })

const listWorkspaceReadmes = (root: string, directoryName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const workspaceRoot = pathService.join(root, directoryName)
    const exists = yield* fileSystem.exists(workspaceRoot)
    return yield* Effect.if(exists, {
      onFalse: () => Effect.succeed(Arr.empty<ReadmeTarget>()),
      onTrue: () =>
        Effect.gen(function*() {
          const entries = yield* fileSystem.readDirectory(workspaceRoot)
          const directories = yield* Effect.filter(
            entries,
            (entry) =>
              fileSystem.stat(pathService.join(workspaceRoot, entry)).pipe(
                Effect.map((stat) => Str.Equivalence(stat.type, "Directory"))
              )
          )
          const readmes = yield* Effect.forEach(
            directories,
            (entry) => existingReadme(root, pathService.join(workspaceRoot, entry)),
            { concurrency: "unbounded" }
          )
          return Arr.getSomes(readmes)
        })
    })
  })

const listReadmeTargets = Effect.gen(function*() {
  const root = yield* projectRoot
  const [rootReadme, packageReadmes, appReadmes] = yield* Effect.all(
    Tuple.make(existingReadme(root, root), listWorkspaceReadmes(root, "packages"), listWorkspaceReadmes(root, "apps")),
    { concurrency: "unbounded" }
  )
  return Arr.appendAll(Arr.appendAll(Arr.fromOption(rootReadme), packageReadmes), appReadmes)
})

const openFence = (line: string, index: number): OpenFence => {
  const tokens = Arr.filter(
    Str.split(Str.toLowerCase(Str.trim(Str.slice(Str.length(FENCE))(line))), /\s+/),
    Str.isNonEmpty
  )
  return new OpenFence({
    startLine: Num.increment(index),
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
          new ReadmeSnippet({
            readme,
            language,
            code: Str.concat(Arr.join(fence.body, "\n"), "\n"),
            line: Num.increment(fence.startLine)
          })
        )
    })
  })

const parseReadmeSnippets = (
  readme: ReadmeTarget,
  content: string
): Effect.Effect<Schema.Schema.Type<Schema.Array$<typeof ReadmeSnippet>>, ReadmeExampleCheckError> => {
  const initial = new ParseState({ snippets: Arr.empty(), open: Option.none() })
  const final = Arr.reduce(Str.split(content, "\n"), initial, (state, line, index) =>
    Option.match(state.open, {
      onNone: () =>
        Bool.match(Str.startsWith(FENCE)(line), {
          onTrue: () => new ParseState({ ...state, open: Option.some(openFence(line, index)) }),
          onFalse: () => state
        }),
      onSome: (fence) =>
        Bool.match(Str.startsWith(FENCE)(line), {
          onTrue: () => closeFence(readme, state, fence),
          onFalse: () =>
            new ParseState({
              ...state,
              open: Option.some(new OpenFence({ ...fence, body: Arr.append(fence.body, line) }))
            })
        })
    }))
  return Option.match(final.open, {
    onNone: () => Effect.succeed(final.snippets),
    onSome: (fence) =>
      new ReadmeExampleCheckError({
        message: Str.concat(
          "Unclosed code fence in ",
          Arr.join(Tuple.make(readme.relativePath, Schema.encodeSync(Schema.NumberFromString)(fence.startLine)), ":")
        )
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
        Effect.flatMap((content) => parseReadmeSnippets(readme, content))
      ),
    { concurrency: "unbounded" }
  )
  return Arr.flatten(snippets)
})
