import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Console, Effect, Option } from "effect"

type PackageDocConfig = readonly [dirName: string, displayName: string, navOrder: number, collection: string]

type ModuleRewriteConfig = {
  readonly srcPath: string
  readonly destPath: string
  readonly parentTitle: string
  readonly grandParentTitle: string | undefined
  readonly leafTitle: string
  readonly dirName: string
  readonly symbolIndex: ReadonlyMap<string, string>
}

const rootUrl = new URL("../", import.meta.url)

const GITHUB_REPO = "https://github.com/scenesystems/theoria"
const GITHUB_BRANCH = "main"

const PACKAGES: ReadonlyArray<PackageDocConfig> = [
  ["effect-math", "effect-math", 1, "effect"],
  ["effect-search", "effect-search", 2, "effect"],
  ["effect-dsp", "effect-dsp", 3, "effect"],
  ["effect-text", "effect-text", 4, "effect"],
  ["digest", "@scenesystems/digest", 1, "scenesystems"],
  ["seal", "@scenesystems/seal", 2, "scenesystems"],
  ["sign", "@scenesystems/sign", 3, "scenesystems"]
]

const PRESERVE = new Set([
  "_config.yml",
  "_includes",
  "_sass",
  "Dockerfile",
  "Gemfile",
  "Gemfile.lock",
  ".jekyll-cache",
  "_site"
])

const resolvePaths = Effect.gen(function*() {
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(rootUrl).pipe(Effect.orDie)

  return {
    root,
    docsOut: path.join(root, "docs"),
    packagesRoot: path.join(root, "packages")
  } as const
})

const pathExists = (targetPath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.exists(targetPath).pipe(Effect.orDie)
  })

const statIfExists = (targetPath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(targetPath).pipe(Effect.orDie)

    if (!exists) {
      return Option.none()
    }

    return Option.some(yield* fileSystem.stat(targetPath).pipe(Effect.orDie))
  })

const ensureDirectory = (targetPath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    yield* fileSystem.makeDirectory(targetPath, { recursive: true }).pipe(Effect.orDie)
  })

const writeText = (targetPath: string, content: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* ensureDirectory(path.dirname(targetPath))
    yield* fileSystem.writeFileString(targetPath, content).pipe(Effect.orDie)
  })

const readText = (targetPath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFileString(targetPath).pipe(Effect.orDie)
  })

const readDirectoryEntries = (targetPath: string, recursive = false) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readDirectory(targetPath, recursive ? { recursive: true } : undefined).pipe(Effect.orDie)
  })

const listRecursiveFiles = (targetPath: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const entries = yield* readDirectoryEntries(targetPath, true)
    const entryKinds = yield* Effect.forEach(
      entries,
      (entry) =>
        statIfExists(path.join(targetPath, entry)).pipe(
          Effect.map((stat) => ({ entry, stat }))
        ),
      { concurrency: "unbounded" }
    )

    return entryKinds
      .flatMap(({ entry, stat }) =>
        Option.match(stat, {
          onNone: () => [] as Array<string>,
          onSome: (info) => (info.type === "Directory" ? [] : [entry])
        })
      )
      .sort((left, right) => left.localeCompare(right))
  })

const collectDirs = (targetPath: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const entries = yield* readDirectoryEntries(targetPath, true)
    const entryKinds = yield* Effect.forEach(
      entries,
      (entry) =>
        statIfExists(path.join(targetPath, entry)).pipe(
          Effect.map((stat) => ({ entry, stat }))
        ),
      { concurrency: "unbounded" }
    )

    return entryKinds
      .flatMap(({ entry, stat }) =>
        Option.match(stat, {
          onNone: () => [] as Array<string>,
          onSome: (info) => (info.type === "Directory" ? [entry] : [])
        })
      )
      .sort((left, right) => left.localeCompare(right))
  })

const stripQuotes = (value: string) => value.trim().replace(/^["']|["']$/g, "")

const isPureBarrel = (targetPath: string) =>
  readText(targetPath).pipe(
    Effect.map((content) => /^## From /m.test(content) && !/export declare/.test(content))
  )

const buildSymbolIndex = (modulesDir: string) =>
  Effect.gen(function*() {
    const files = yield* listRecursiveFiles(modulesDir)
    const markdownFiles = files.filter((relativePath) => relativePath.endsWith(".md") && relativePath !== "index.md")
    const symbolEntries = yield* Effect.forEach(markdownFiles, (relativePath) =>
      readText(`${modulesDir}/${relativePath}`).pipe(
        Effect.map((content) => {
          const headingRe = /^## (\w+)\s*$/gm
          const entries = new Map<string, string>()
          let match: RegExpExecArray | null
          while ((match = headingRe.exec(content)) !== null) {
            const symbol = match[1] ?? ""
            if (!symbol.endsWith("overview")) {
              entries.set(symbol, `${relativePath.replace(/\.md$/, ".html")}#${symbol.toLowerCase()}`)
            }
          }
          return entries
        })
      ))

    return symbolEntries.reduce<Map<string, string>>((index, entries) => {
      entries.forEach((value, key) => {
        index.set(key, value)
      })
      return index
    }, new Map())
  })

const rewriteLinks = (content: string, originalTitle: string, symbolIndex: ReadonlyMap<string, string>) => {
  const thisPageRel = originalTitle.length === 0 ? "" : originalTitle.replace(/\.ts$/, ".ts.html")
  const thisPageDir = thisPageRel.includes("/") ? thisPageRel.slice(0, thisPageRel.lastIndexOf("/")) : ""

  return content.replace(/\{@link\s+(\w+)\}/g, (_full, name: string) => {
    const targetUrl = symbolIndex.get(name)
    if (targetUrl === undefined) {
      return `\`${name}\``
    }

    const targetDir = targetUrl.includes("/") ? targetUrl.slice(0, targetUrl.lastIndexOf("/")) : ""
    if (thisPageDir === targetDir) {
      const lastSlash = targetUrl.lastIndexOf("/")
      return `[\`${name}\`](${lastSlash >= 0 ? targetUrl.slice(lastSlash + 1) : targetUrl})`
    }

    const upCount = thisPageDir.length === 0 ? 0 : thisPageDir.split("/").length
    return `[\`${name}\`](${"../".repeat(upCount)}${targetUrl})`
  })
}

const rewriteModulePage = (config: ModuleRewriteConfig) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    let content = yield* readText(config.srcPath)
    const titleMatch = content.match(/^title: (.+)$/m)
    const originalTitle = titleMatch ? stripQuotes(titleMatch[1] ?? "") : ""

    content = content.replace(/^title: .+$/m, `title: "${config.leafTitle}"`)
    content = content.replace(/^parent: .+$/m, `parent: "${config.parentTitle}"`)

    if (config.grandParentTitle !== undefined) {
      content = content.replace(/^(parent: .+)$/m, `$1\ngrand_parent: "${config.grandParentTitle}"`)
    }

    if (originalTitle.length > 0) {
      const srcFilePath = path.join((yield* resolvePaths).packagesRoot, config.dirName, "src", originalTitle)
      const symbolLines = new Map<string, number>()

      if (yield* pathExists(srcFilePath)) {
        ;(yield* readText(srcFilePath)).split("\n").forEach((line, index) => {
          const match = line.match(/^export (?:const|function|class|type|interface|declare)\s+(\w+)/)
          const symbol = match?.[1]
          if (symbol !== undefined) {
            symbolLines.set(symbol, index + 1)
          }
        })
      }

      const srcUrl = `${GITHUB_REPO}/blob/${GITHUB_BRANCH}/packages/${config.dirName}/src/${originalTitle}`
      content = content.replace(/^---\n\n/m, `---\n\n> [View source](${srcUrl})\n\n`)
      content = content.replace(/^## (\w+)\n\n([\s\S]*?)\*\*Signature\*\*/gm, (full, symbolName: string, between: string) => {
        const line = symbolLines.get(symbolName)
        return line === undefined ? full : `## ${symbolName}\n\n${between}**Signature** ([source](${srcUrl}#L${line}))`
      })
    }

    yield* writeText(config.destPath, rewriteLinks(content, originalTitle, config.symbolIndex))
  })

const createDirGroupPage = (destPath: string, title: string, parentTitle: string, grandParentTitle: string | undefined, navOrder: number) =>
  writeText(destPath, [
    "---",
    `title: "${title}"`,
    "has_children: true",
    `parent: "${parentTitle}"`,
    ...(grandParentTitle === undefined ? [] : [`grand_parent: "${grandParentTitle}"`]),
    `nav_order: ${navOrder}`,
    "---",
    ""
  ].join("\n"))

const getPackageDescription = (dirName: string) =>
  Effect.gen(function*() {
    const packageJsonPath = `${(yield* resolvePaths).packagesRoot}/${dirName}/package.json`
    if (!(yield* pathExists(packageJsonPath))) {
      return ""
    }

    try {
      const parsed = JSON.parse(yield* readText(packageJsonPath)) as { readonly description?: unknown }
      return typeof parsed.description === "string" ? parsed.description : ""
    } catch {
      return ""
    }
  })

const processModuleFiles = (
  srcDir: string,
  destDir: string,
  packageDisplayName: string,
  dirTitleMap: ReadonlyMap<string, string>,
  dirParentMap: ReadonlyMap<string, string>,
  ambiguousDirNames: ReadonlySet<string>,
  relPrefix: string,
  pkgDirName: string,
  symbolIndex: ReadonlyMap<string, string>
) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const entries = yield* readDirectoryEntries(srcDir)

    yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const srcPath = path.join(srcDir, entry)
        const destPath = path.join(destDir, entry)
        const stat = yield* statIfExists(srcPath)

        if (Option.isNone(stat)) {
          return
        }

        if (stat.value.type === "Directory") {
          yield* ensureDirectory(destPath)
          const childRel = relPrefix.length === 0 ? entry : `${relPrefix}/${entry}`
          yield* processModuleFiles(srcPath, destPath, packageDisplayName, dirTitleMap, dirParentMap, ambiguousDirNames, childRel, pkgDirName, symbolIndex)
          return
        }

        if (entry === "index.md") {
          return
        }

        if (entry === "index.ts.md" && (yield* isPureBarrel(srcPath))) {
          return
        }

        if (!entry.endsWith(".md")) {
          return
        }

        const parentTitle = relPrefix.length === 0 ? packageDisplayName : (dirTitleMap.get(relPrefix) ?? relPrefix)
        const grandParentTitle = relPrefix.length > 0 && ambiguousDirNames.has(parentTitle)
          ? dirParentMap.get(relPrefix)
          : undefined

        yield* rewriteModulePage({
          srcPath,
          destPath,
          parentTitle,
          grandParentTitle,
          leafTitle: entry.replace(/\.md$/, ""),
          dirName: pkgDirName,
          symbolIndex
        })
      }))
  })

const processPackage = ([dirName, displayName, navOrder, collection]: PackageDocConfig, ambiguousDirNames: ReadonlySet<string>) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const { packagesRoot, docsOut } = yield* resolvePaths
    const packageRoot = path.join(packagesRoot, dirName)
    const modulesDir = path.join(packageRoot, "docs", "modules")
    const destDir = path.join(docsOut, `_${collection}`, dirName)

    if (!(yield* pathExists(modulesDir))) {
      yield* Console.log(`⏭ Skipping ${displayName} (no docs/modules/)`)
      return
    }

    yield* ensureDirectory(destDir)

    const readmePath = path.join(packageRoot, "README.md")
    const readmeContent = (yield* pathExists(readmePath))
      ? (yield* readText(readmePath))
        .replace(/^# .+\n+/, "")
        .replace(/^(\[!\[.*?\].*?\n)+\n*/m, "")
      : ""

    yield* writeText(path.join(destDir, "index.md"), [
      "---",
      `title: "${displayName}"`,
      "has_children: true",
      `nav_order: ${navOrder}`,
      "---",
      "",
      `# ${displayName}`,
      "",
      ...(readmeContent.length === 0 ? [] : [readmeContent]),
      ""
    ].join("\n"))

    const dirs = yield* collectDirs(modulesDir)
    const dirTitleMap = new Map<string, string>()
    const dirParentMap = new Map<string, string>()

    yield* Effect.forEach(
      dirs
        .slice()
        .sort((left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right)),
      (relDir, index) => {
        const parts = relDir.split("/")
        const title = path.basename(relDir)
        const parentRelDir = parts.length === 1 ? undefined : parts.slice(0, -1).join("/")
        const parentTitle = parentRelDir === undefined ? displayName : (dirTitleMap.get(parentRelDir) ?? parentRelDir)
        const grandParentTitle = parentRelDir !== undefined && ambiguousDirNames.has(parentTitle)
          ? dirParentMap.get(parentRelDir)
          : undefined

        dirTitleMap.set(relDir, title)
        dirParentMap.set(relDir, parentTitle)

        return createDirGroupPage(path.join(destDir, relDir, "index.md"), title, parentTitle, grandParentTitle, index + 1)
      }
    )

    const symbolIndex = yield* buildSymbolIndex(modulesDir)
    yield* processModuleFiles(modulesDir, destDir, displayName, dirTitleMap, dirParentMap, ambiguousDirNames, "", dirName, symbolIndex)

    const files = yield* listRecursiveFiles(modulesDir)
    const markdownCount = files.filter((file) => file.endsWith(".md") && file !== "index.md").length
    yield* Console.log(`✓ ${displayName}: ${markdownCount} module docs, ${dirs.length} directory groups`)
  })

const cleanDocsOutput = Effect.gen(function*() {
  const path = yield* Path.Path
  const fileSystem = yield* FileSystem.FileSystem
  const { docsOut } = yield* resolvePaths
  const exists = yield* fileSystem.exists(docsOut).pipe(Effect.orDie)

  if (exists) {
    const entries = yield* readDirectoryEntries(docsOut)
    yield* Effect.forEach(entries.filter((entry) => !PRESERVE.has(entry)), (entry) =>
      fileSystem.remove(path.join(docsOut, entry), { recursive: true, force: true }).pipe(Effect.orDie))
  }

  yield* ensureDirectory(docsOut)
})

const findAmbiguousDirNames = Effect.gen(function*() {
  const path = yield* Path.Path
  const { packagesRoot } = yield* resolvePaths
  const basenames = yield* Effect.forEach(PACKAGES, ([dirName]) =>
    Effect.gen(function*() {
      const modulesDir = path.join(packagesRoot, dirName, "docs", "modules")
      if (!(yield* pathExists(modulesDir))) {
        return [] as Array<string>
      }

      return (yield* collectDirs(modulesDir)).map((dirPath) => path.basename(dirPath))
    }))

  const counts = basenames.flat().reduce<Map<string, number>>((map, name) => {
    map.set(name, (map.get(name) ?? 0) + 1)
    return map
  }, new Map())

  return new Set(Array.from(counts.entries()).flatMap(([name, count]) => (count > 1 ? [name] : [])))
})

const writeRootIndex = Effect.gen(function*() {
  const path = yield* Path.Path
  const { docsOut } = yield* resolvePaths
  const descriptions = new Map(
    yield* Effect.forEach(PACKAGES, ([dirName]) => getPackageDescription(dirName).pipe(Effect.map((description) => [dirName, description] as const)))
  )

  yield* writeText(path.join(docsOut, "index.md"), [
    "---",
    "title: Home",
    "nav_order: 1",
    "---",
    "",
    "# Theoria",
    "",
    "API documentation for the [Theoria](https://github.com/scenesystems/theoria) open-source research software ecosystem by [Scene Systems](https://scenesystems.io).",
    "",
    "## Packages",
    "",
    ...PACKAGES.map(([dirName, displayName, , collection]) =>
      `- [**${displayName}**](${collection}/${dirName}/) — ${descriptions.get(dirName) ?? ""}`
    ),
    ""
  ].join("\n"))
})

const program = Effect.gen(function*() {
  yield* cleanDocsOutput
  const ambiguousDirNames = yield* findAmbiguousDirNames

  if (ambiguousDirNames.size > 0) {
    yield* Console.log(`ℹ Ambiguous directory names (will use grand_parent): ${Arr.fromIterable(ambiguousDirNames).join(", ")}`)
  }

  yield* writeRootIndex
  yield* Effect.forEach(PACKAGES, (config) => processPackage(config, ambiguousDirNames))
  yield* Console.log("\nDocs aggregation complete -> docs/")
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
