import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect"

import { PackageNameSchema, ReleaseVersionSchema } from "./identifiers.js"
import type { PackageName, ReleaseVersion } from "./identifiers.js"
import { markdownSectionBlocks, normalizePackageDocsAnchor } from "./internal/packageDocsMarkdown.js"
import {
  type PackageDocsBundle,
  type PackageDocsCatalogEntry,
  type PackageDocsCodeLanguage,
  type PackageDocsCorpus,
  type PackageDocsDocument,
  type PackageDocsExample,
  type PackageDocsProofCommand,
  type PackageDocsQuery,
  type PackageDocsReleaseSnapshot,
  PackageDocsRichTextDocument,
  PackageDocsRichTextElementNode,
  PackageDocsRichTextTextNode,
  type PackageDocsSearchResult,
  type PackageDocsSectionBlock,
  type PackageDocsSourceKind,
  TheoriaPackageDocsAuthority
} from "./packageDocsSchema.js"
import { buildPackageDocsSearchIndex, searchPackageDocsIndex } from "./packageDocsSearch.js"
import { resolveRootFrom, toForwardSlashes } from "./projectPath.js"
import { ReleaseSinceSnapshotJson } from "./releaseSince.js"

const repositoryRootUrl = new URL("../../../", import.meta.url)

const PackageDocsManifestSchema = Schema.Struct({
  name: PackageNameSchema,
  version: ReleaseVersionSchema,
  private: Schema.optional(Schema.Boolean),
  description: Schema.optional(Schema.String),
  scripts: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.String
    })
  )
})

const PackageDocsManifestJson = Schema.parseJson(PackageDocsManifestSchema)

type PackageDocsManifest = typeof PackageDocsManifestSchema.Type

const trimPrefix = (value: string, prefix: string): string =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value

const withoutSuffix = (value: string, suffix: string): string =>
  value.endsWith(suffix)
    ? value.slice(0, value.length - suffix.length)
    : value

const inlineTextDocument = (text: string): PackageDocsRichTextDocument =>
  text.length === 0
    ? PackageDocsRichTextDocument.make({ children: [] })
    : PackageDocsRichTextDocument.make({
      children: [PackageDocsRichTextTextNode.make({ value: text })]
    })

const paragraphTextDocument = (text: string): PackageDocsRichTextDocument =>
  text.length === 0
    ? PackageDocsRichTextDocument.make({ children: [] })
    : PackageDocsRichTextDocument.make({
      children: [
        PackageDocsRichTextElementNode.make({
          children: [PackageDocsRichTextTextNode.make({ value: text })],
          properties: {},
          tagName: "p"
        })
      ]
    })

const packageDocsCodeLanguageFromPath = (path: string): PackageDocsCodeLanguage =>
  path.endsWith(".json") || path.endsWith(".jsonc")
    ? "json"
    : path.endsWith(".sh") || path.endsWith(".bash") || path.endsWith(".zsh")
    ? "shell"
    : path.endsWith(".js") || path.endsWith(".jsx") || path.endsWith(".mjs") || path.endsWith(".ts")
        || path.endsWith(".tsx") || path.endsWith(".mts")
    ? "ts"
    : "plain"

const scriptTitle = (name: string): string => `Script ${name}`

const isProofScriptName = (name: string): boolean =>
  name === "build"
  || name === "docgen"
  || name === "lint"
  || name === "publish:check"
  || name === "release-snapshots:stamp"
  || name === "test"
  || name === "changeset-publish"
  || name.startsWith("bench")
  || name.startsWith("check")
  || name.startsWith("fixtures:")
  || name.startsWith("verify:")

const repositoryRelativePath = (pathService: Path.Path, repositoryRoot: string, absolutePath: string): string =>
  toForwardSlashes(pathService, pathService.relative(repositoryRoot, absolutePath))

const readFileIfPresent = (absolutePath: string): Effect.Effect<string, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(absolutePath).pipe(Effect.orDie)

    return exists
      ? yield* fileSystem.readFileString(absolutePath).pipe(Effect.orDie)
      : ""
  })

const listFilesWithSuffix = (
  directory: string,
  suffix: string
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(directory).pipe(Effect.orDie)

    if (!exists) {
      return []
    }

    return Arr.fromIterable(yield* fileSystem.readDirectory(directory, { recursive: true }).pipe(Effect.orDie))
      .filter((entry) => entry.endsWith(suffix))
      .sort((left, right) => left.localeCompare(right))
  })

const loadPackageManifest = (
  packageRoot: string
): Effect.Effect<PackageDocsManifest, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const manifestJson = yield* readFileIfPresent(pathService.join(packageRoot, "package.json"))

    return yield* Schema.decodeUnknown(PackageDocsManifestJson)(manifestJson).pipe(Effect.orDie)
  })

const loadShippedPackageRoots = (
  repositoryRoot: string
): Effect.Effect<ReadonlyArray<readonly [string, PackageDocsManifest]>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const packagesRoot = pathService.join(repositoryRoot, "packages")
    const entries = Arr.fromIterable(yield* fileSystem.readDirectory(packagesRoot).pipe(Effect.orDie)).sort((
      left,
      right
    ) => left.localeCompare(right)).filter((entry) => !entry.startsWith("."))

    const manifests = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const packageRoot = pathService.join(packagesRoot, entry)
        const hasManifest = yield* fileSystem.exists(pathService.join(packageRoot, "package.json")).pipe(Effect.orDie)

        if (!hasManifest) {
          return Option.none<readonly [string, PackageDocsManifest]>()
        }

        const manifest = yield* loadPackageManifest(packageRoot)
        const packageEntry: readonly [string, PackageDocsManifest] = [packageRoot, manifest]

        return manifest.private === true
          ? Option.none<readonly [string, PackageDocsManifest]>()
          : Option.some(packageEntry)
      }))

    return Arr.filterMap(manifests, (entry) => entry)
  })

const documentSource = (input: {
  readonly packageId: PackageName
  readonly kind: PackageDocsSourceKind
  readonly path: string
  readonly title: string
}) => ({
  packageId: input.packageId,
  kind: input.kind,
  path: input.path,
  anchor: null,
  title: input.title
})

const documentTitleFromRelativePath = (input: {
  readonly packageDirectory: string
  readonly relativePath: string
  readonly prefix: string
  readonly suffix: string
}): string => withoutSuffix(trimPrefix(input.relativePath, `${input.packageDirectory}/${input.prefix}`), input.suffix)

const makeExampleBlock = (input: {
  readonly packageId: PackageName
  readonly path: string
  readonly title: string
  readonly content: string
}): PackageDocsSectionBlock => ({
  contentDocument: null,
  id: `${input.path}#${normalizePackageDocsAnchor(input.title)}`,
  kind: "example-code",
  language: packageDocsCodeLanguageFromPath(input.path),
  title: input.title,
  titleDocument: inlineTextDocument(input.title),
  content: input.content.trim(),
  source: {
    packageId: input.packageId,
    kind: "example",
    path: input.path,
    anchor: normalizePackageDocsAnchor(input.title),
    title: input.title
  }
})

const makeSnapshotBlock = (input: {
  readonly packageId: PackageName
  readonly path: string
  readonly releasedVersion: ReleaseVersion
  readonly exportCount: number
}): PackageDocsSectionBlock => {
  const title = `Release snapshot ${input.releasedVersion}`
  const content = `Release snapshot ${input.releasedVersion} captures ${input.exportCount} exported surface entries.`

  return {
    content,
    contentDocument: paragraphTextDocument(content),
    id: `${input.path}#${normalizePackageDocsAnchor(input.releasedVersion)}`,
    kind: "release-snapshot-summary",
    language: null,
    title,
    titleDocument: inlineTextDocument(title),
    source: {
      packageId: input.packageId,
      kind: "release-snapshot",
      path: input.path,
      anchor: normalizePackageDocsAnchor(input.releasedVersion),
      title
    }
  }
}

const makeProofCommand = (input: {
  readonly packageId: PackageName
  readonly manifestPath: string
  readonly name: string
  readonly command: string
}): PackageDocsProofCommand => {
  const title = scriptTitle(input.name)

  return {
    name: input.name,
    command: input.command,
    source: {
      packageId: input.packageId,
      kind: "proof-command",
      path: input.manifestPath,
      anchor: `scripts.${normalizePackageDocsAnchor(input.name)}`,
      title
    },
    block: {
      contentDocument: null,
      id: `${input.manifestPath}#scripts.${normalizePackageDocsAnchor(input.name)}`,
      kind: "proof-command",
      language: "shell",
      title,
      titleDocument: inlineTextDocument(title),
      content: input.command,
      source: {
        packageId: input.packageId,
        kind: "proof-command",
        path: input.manifestPath,
        anchor: `scripts.${normalizePackageDocsAnchor(input.name)}`,
        title
      }
    }
  }
}

const loadMarkdownDocument = (input: {
  readonly repositoryRoot: string
  readonly packageId: PackageName
  readonly kind: PackageDocsSourceKind
  readonly absolutePath: string
  readonly relativePath: string
  readonly title: string
  readonly excerptKind: "readme-section" | "module-doc-section"
}): Effect.Effect<PackageDocsDocument, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const content = yield* readFileIfPresent(input.absolutePath)

    return {
      title: input.title,
      source: documentSource({
        packageId: input.packageId,
        kind: input.kind,
        path: input.relativePath,
        title: input.title
      }),
      blocks: markdownSectionBlocks({
        packageId: input.packageId,
        path: input.relativePath,
        documentTitle: input.title,
        sourceKind: input.kind,
        excerptKind: input.excerptKind,
        text: content
      })
    }
  })

const loadExample = (input: {
  readonly packageId: PackageName
  readonly absolutePath: string
  readonly relativePath: string
  readonly title: string
}): Effect.Effect<PackageDocsExample, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const content = yield* readFileIfPresent(input.absolutePath)

    return {
      title: input.title,
      source: documentSource({
        packageId: input.packageId,
        kind: "example",
        path: input.relativePath,
        title: input.title
      }),
      block: makeExampleBlock({
        packageId: input.packageId,
        path: input.relativePath,
        title: input.title,
        content
      })
    }
  })

const loadReleaseSnapshot = (input: {
  readonly packageId: PackageName
  readonly absolutePath: string
  readonly relativePath: string
}): Effect.Effect<PackageDocsReleaseSnapshot, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const content = yield* readFileIfPresent(input.absolutePath)
    const snapshot = yield* Schema.decodeUnknown(ReleaseSinceSnapshotJson)(content).pipe(Effect.orDie)
    const block = makeSnapshotBlock({
      packageId: input.packageId,
      path: input.relativePath,
      releasedVersion: snapshot.releasedVersion,
      exportCount: snapshot.exports.length
    })

    return {
      releasedVersion: snapshot.releasedVersion,
      source: block.source,
      block
    }
  })

const catalogEntry = (bundle: PackageDocsBundle): PackageDocsCatalogEntry => ({
  packageId: bundle.packageId,
  packageDirectory: bundle.packageDirectory,
  version: bundle.version,
  description: bundle.description,
  readmePath: bundle.readme.source.path,
  moduleDocCount: bundle.moduleDocs.length,
  exampleCount: bundle.examples.length,
  releaseSnapshotCount: bundle.releaseSnapshots.length,
  proofCommandCount: bundle.proofCommands.length
})

const loadPackageDocsBundle = (input: {
  readonly repositoryRoot: string
  readonly packageRoot: string
  readonly manifest: PackageDocsManifest
}): Effect.Effect<PackageDocsBundle, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const packageDirectory = repositoryRelativePath(pathService, input.repositoryRoot, input.packageRoot)
    const manifestPath = `${packageDirectory}/package.json`
    const readmeAbsolutePath = pathService.join(input.packageRoot, "README.md")
    const readmePath = `${packageDirectory}/README.md`
    const moduleDocEntries = yield* listFilesWithSuffix(pathService.join(input.packageRoot, "docs/modules"), ".md")
    const exampleEntries = yield* listFilesWithSuffix(pathService.join(input.packageRoot, "examples"), ".ts")
    const snapshotEntries = yield* listFilesWithSuffix(
      pathService.join(input.packageRoot, "test/package/release-snapshots"),
      ".json"
    )
    const readme = yield* loadMarkdownDocument({
      repositoryRoot: input.repositoryRoot,
      packageId: input.manifest.name,
      kind: "readme",
      absolutePath: readmeAbsolutePath,
      relativePath: readmePath,
      title: `${input.manifest.name} README`,
      excerptKind: "readme-section"
    })
    const moduleDocs = yield* Effect.forEach(moduleDocEntries, (entry) => {
      const absolutePath = pathService.join(input.packageRoot, "docs/modules", entry)
      const relativePath = repositoryRelativePath(pathService, input.repositoryRoot, absolutePath)

      return loadMarkdownDocument({
        repositoryRoot: input.repositoryRoot,
        packageId: input.manifest.name,
        kind: "module-doc",
        absolutePath,
        relativePath,
        title: documentTitleFromRelativePath({
          packageDirectory,
          relativePath,
          prefix: "docs/modules/",
          suffix: ".md"
        }),
        excerptKind: "module-doc-section"
      })
    })
    const examples = yield* Effect.forEach(exampleEntries, (entry) => {
      const absolutePath = pathService.join(input.packageRoot, "examples", entry)
      const relativePath = repositoryRelativePath(pathService, input.repositoryRoot, absolutePath)

      return loadExample({
        packageId: input.manifest.name,
        absolutePath,
        relativePath,
        title: documentTitleFromRelativePath({
          packageDirectory,
          relativePath,
          prefix: "examples/",
          suffix: ".ts"
        })
      })
    })
    const releaseSnapshots = yield* Effect.forEach(snapshotEntries, (entry) => {
      const absolutePath = pathService.join(input.packageRoot, "test/package/release-snapshots", entry)

      return loadReleaseSnapshot({
        packageId: input.manifest.name,
        absolutePath,
        relativePath: repositoryRelativePath(pathService, input.repositoryRoot, absolutePath)
      })
    })
    const proofCommands = Arr.fromIterable(Rec.toEntries(input.manifest.scripts ?? {}))
      .filter(([name]) => isProofScriptName(name))
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, command]) =>
        makeProofCommand({
          packageId: input.manifest.name,
          manifestPath,
          name,
          command
        })
      )

    return {
      packageId: input.manifest.name,
      packageDirectory,
      version: input.manifest.version,
      description: input.manifest.description ?? null,
      manifestSource: documentSource({
        packageId: input.manifest.name,
        kind: "package-manifest",
        path: manifestPath,
        title: `${input.manifest.name} manifest`
      }),
      readme,
      moduleDocs,
      examples,
      releaseSnapshots,
      proofCommands
    }
  })

/**
 * Loads the canonical root-owned package-doc corpus from shipped package surfaces.
 *
 * @since 0.0.0
 * @category queries
 */
export const loadPackageDocsCorpus = (input?: {
  readonly repositoryRoot?: string
}): Effect.Effect<PackageDocsCorpus, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const repositoryRoot = input?.repositoryRoot ?? (yield* resolveRootFrom(repositoryRootUrl))
    const packageRoots = yield* loadShippedPackageRoots(repositoryRoot)
    const bundles = Arr.fromIterable(
      yield* Effect.forEach(packageRoots, ([packageRoot, manifest]) =>
        loadPackageDocsBundle({
          repositoryRoot,
          packageRoot,
          manifest
        }))
    ).sort((left, right) => left.packageId.localeCompare(right.packageId))

    return {
      catalog: bundles.map(catalogEntry),
      bundles
    }
  })

/**
 * Returns the canonical package-doc catalog from a loaded corpus.
 *
 * @since 0.0.0
 * @category queries
 */
export const packageDocsCatalog = (corpus: PackageDocsCorpus): ReadonlyArray<PackageDocsCatalogEntry> => corpus.catalog

/**
 * Resolves one normalized package-doc bundle by package id.
 *
 * @since 0.0.0
 * @category queries
 */
export const packageDocsBundle = (
  corpus: PackageDocsCorpus,
  packageId: PackageName
): Option.Option<PackageDocsBundle> =>
  Option.fromNullable(corpus.bundles.find((bundle) => bundle.packageId === packageId))

/**
 * Runs bounded package-doc search over the canonical root-owned corpus.
 *
 * @since 0.0.0
 * @category queries
 */
export const searchPackageDocs = (
  corpus: PackageDocsCorpus,
  query: PackageDocsQuery
): ReadonlyArray<PackageDocsSearchResult> => searchPackageDocsIndex(buildPackageDocsSearchIndex(corpus), query)

/**
 * Root-owned package-doc authority metadata for repository and consumer tests.
 *
 * @since 0.0.0
 * @category constants
 */
export const packageDocsAuthority = TheoriaPackageDocsAuthority
