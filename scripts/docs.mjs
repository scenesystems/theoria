/* global console */
// Aggregates per-package docgen output into a unified docs/ tree for GitHub Pages.
// Follows the same pattern as Effect-TS/effect scripts/docs.mjs.
// Run after `bun run docgen`: node scripts/docs.mjs
import * as Fs from "node:fs"
import * as Path from "node:path"

const ROOT = Path.resolve(import.meta.dirname, "..")
const DOCS_OUT = Path.join(ROOT, "docs")

const GITHUB_REPO = "https://github.com/scenesystems/theoria"
const GITHUB_BRANCH = "main"

/**
 * Package definitions: [dirName, displayName, navOrder, collection]
 * collection maps to a Just the Docs collection (sidebar section).
 */
const PACKAGES = [
  ["effect-search", "effect-search", 1, "effect"],
  ["effect-dsp", "effect-dsp", 2, "effect"],
  ["effect-math", "effect-math", 3, "effect"],
  ["digest", "@scenesystems/digest", 1, "scenesystems"],
  ["seal", "@scenesystems/seal", 2, "scenesystems"],
  ["sign", "@scenesystems/sign", 3, "scenesystems"]
]

/** Files/dirs to preserve during clean */
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

function ensureDir(dir) {
  if (!Fs.existsSync(dir)) {
    Fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Detect whether a docgen markdown file is a pure barrel (re-export only).
 * Pure barrels contain `## From ` headers but no `export declare` signatures.
 */
function isPureBarrel(filePath) {
  const content = Fs.readFileSync(filePath, "utf8")
  const hasReExports = /^## From /m.test(content)
  const hasDeclare = /export declare/.test(content)
  return hasReExports && !hasDeclare
}

/**
 * Collect the full directory tree under a docgen modules/ folder.
 * Returns an array of relative dir paths (e.g. ["Sampler", "Sampler/shared", "Study/runtime"]).
 */
function collectDirs(srcDir) {
  const dirs = []
  function walk(dir, rel) {
    const entries = Fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name
        dirs.push(relPath)
        walk(Path.join(dir, entry.name), relPath)
      }
    }
  }
  walk(srcDir, "")
  return dirs
}

/**
 * Build a set of directory basenames that appear in multiple packages,
 * so we know which titles need grand_parent disambiguation.
 */
function findAmbiguousDirNames() {
  /** @type {Map<string, string[]>} basename → [packageName, ...] */
  const nameToPackages = new Map()
  for (const [dirName, , ] of PACKAGES) {
    const srcDir = Path.join(ROOT, "packages", dirName, "docs", "modules")
    if (!Fs.existsSync(srcDir)) continue
    const dirs = collectDirs(srcDir)
    for (const d of dirs) {
      const basename = Path.basename(d)
      if (!nameToPackages.has(basename)) nameToPackages.set(basename, [])
      nameToPackages.get(basename).push(dirName)
    }
  }
  const ambiguous = new Set()
  for (const [name, pkgs] of nameToPackages) {
    if (pkgs.length > 1) ambiguous.add(name)
  }
  return ambiguous
}

/**
 * Create an intermediate navigation page for a directory group.
 *
 * @param {string} destPath - Where to write the index.md
 * @param {string} title - Display title for this directory
 * @param {string} parentTitle - Parent page title
 * @param {string|undefined} grandParentTitle - Grand-parent for disambiguation
 * @param {number} navOrder - Navigation order
 */
function createDirGroupPage(destPath, title, parentTitle, grandParentTitle, navOrder) {
  const lines = [
    "---",
    `title: "${title}"`,
    "has_children: true",
    `parent: "${parentTitle}"`,
  ]
  if (grandParentTitle) {
    lines.push(`grand_parent: "${grandParentTitle}"`)
  }
  lines.push(`nav_order: ${navOrder}`)
  lines.push("---")
  lines.push("")

  ensureDir(Path.dirname(destPath))
  Fs.writeFileSync(destPath, lines.join("\n"))
}

/**
 * Build a symbol → doc page URL index for a package.
 * Scans all docgen markdown files for `## symbolName` headings and maps them
 * to `relPath.html#anchor` URLs relative to the package doc root.
 *
 * @param {string} modulesDir - e.g. packages/digest/docs/modules
 * @returns {Map<string, string>} symbolName → relative URL (e.g. "algorithms/blake3.ts.html#blake3hash")
 */
function buildSymbolIndex(modulesDir) {
  /** @type {Map<string, string>} */
  const index = new Map()
  if (!Fs.existsSync(modulesDir)) return index

  function walk(dir, relPrefix) {
    const entries = Fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(Path.join(dir, entry.name), relPrefix ? `${relPrefix}/${entry.name}` : entry.name)
      } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
        const filePath = Path.join(dir, entry.name)
        const content = Fs.readFileSync(filePath, "utf8")
        const pageUrl = relPrefix
          ? `${relPrefix}/${entry.name.replace(/\.md$/, ".html")}`
          : entry.name.replace(/\.md$/, ".html")

        // Match ## headings that are symbol names (word chars only, not "overview" headings)
        const headingRe = /^## (\w+)\s*$/gm
        let match
        while ((match = headingRe.exec(content)) !== null) {
          const sym = match[1]
          if (sym.endsWith("overview")) continue
          const anchor = sym.toLowerCase()
          index.set(sym, `${pageUrl}#${anchor}`)
        }
      }
    }
  }
  walk(modulesDir, "")
  return index
}

/**
 * Rewrite a docgen module markdown file with correct parent/grand_parent hierarchy.
 *
 * @param {string} srcPath - Source file path
 * @param {string} destPath - Destination file path
 * @param {string} parentTitle - Immediate parent title
 * @param {string|undefined} grandParentTitle - Grand-parent for disambiguation
 * @param {string} leafTitle - Display title (just the filename, not the full path)
 * @param {string} dirName - Package directory name (e.g. "effect-search")
 * @param {Map<string, string>} symbolIndex - symbol → relative URL index
 */
function rewriteModulePage(srcPath, destPath, parentTitle, grandParentTitle, leafTitle, dirName, symbolIndex) {
  let content = Fs.readFileSync(srcPath, "utf8")

  // Extract the original docgen title (contains source path like "Sampler/constructors.ts")
  const titleMatch = content.match(/^title: (.+)$/m)
  const originalTitle = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, "") : ""

  // Replace the title (docgen uses full path like "Study/runtime/scheduler/rounds.ts")
  content = content.replace(
    /^title: .+$/m,
    `title: "${leafTitle}"`
  )

  // Replace parent
  content = content.replace(
    /^parent: .+$/m,
    `parent: "${parentTitle}"`
  )

  // Add grand_parent if needed (insert after parent line)
  if (grandParentTitle) {
    content = content.replace(
      /^(parent: .+)$/m,
      `$1\ngrand_parent: "${grandParentTitle}"`
    )
  }

  // Build per-symbol line number index from the source file
  const symbolLines = new Map()
  if (originalTitle) {
    const srcFilePath = Path.join(ROOT, "packages", dirName, "src", originalTitle)
    if (Fs.existsSync(srcFilePath)) {
      const srcLines = Fs.readFileSync(srcFilePath, "utf8").split("\n")
      for (let i = 0; i < srcLines.length; i++) {
        const match = srcLines[i].match(/^export (?:const|function|class|type|interface|declare)\s+(\w+)/)
        if (match) {
          symbolLines.set(match[1], i + 1)
        }
      }
    }

    const srcUrl = `${GITHUB_REPO}/blob/${GITHUB_BRANCH}/packages/${dirName}/src/${originalTitle}`

    // Add file-level "View source" link after frontmatter
    content = content.replace(
      /^---\n\n/m,
      `---\n\n> [View source](${srcUrl})\n\n`
    )

    // Inject per-symbol source links: find each ## heading followed by a **Signature** block
    // and add a source link with the line number
    content = content.replace(
      /^## (\w+)\n\n([\s\S]*?)\*\*Signature\*\*/gm,
      (full, symbolName, between) => {
        const line = symbolLines.get(symbolName)
        if (line) {
          return `## ${symbolName}\n\n${between}**Signature** ([source](${srcUrl}#L${line}))`
        }
        return full
      }
    )
  }

  // Resolve {@link symbolName} tags to clickable links using the symbol index.
  // Compute the relative path from this doc page to the target symbol's page.
  const thisPageRel = originalTitle
    ? originalTitle.replace(/\.ts$/, ".ts.html")
    : ""
  const thisPageDir = thisPageRel.includes("/")
    ? thisPageRel.slice(0, thisPageRel.lastIndexOf("/"))
    : ""

  content = content.replace(
    /\{@link\s+(\w+)\}/g,
    (full, name) => {
      const targetUrl = symbolIndex.get(name)
      if (!targetUrl) return `\`${name}\``

      // Compute relative path from this page's directory to the target
      const targetDir = targetUrl.includes("/")
        ? targetUrl.slice(0, targetUrl.lastIndexOf("/"))
        : ""
      let relUrl
      if (thisPageDir === targetDir) {
        // Same directory — just the filename#anchor
        relUrl = targetUrl.includes("/")
          ? targetUrl.slice(targetUrl.lastIndexOf("/") + 1)
          : targetUrl
      } else {
        // Different directory — go up and back down
        const upCount = thisPageDir ? thisPageDir.split("/").length : 0
        relUrl = "../".repeat(upCount) + targetUrl
      }
      return `[\`${name}\`](${relUrl})`
    }
  )

  ensureDir(Path.dirname(destPath))
  Fs.writeFileSync(destPath, content)
}

/**
 * Process a single package: create directory group pages and rewrite module pages.
 */
function processPackage(dirName, displayName, navOrder, collection, ambiguousDirNames) {
  const pkgDocsModules = Path.join(ROOT, "packages", dirName, "docs", "modules")
  const destDir = Path.join(DOCS_OUT, `_${collection}`, dirName)

  if (!Fs.existsSync(pkgDocsModules)) {
    console.log(`⏭ Skipping ${displayName} (no docs/modules/)`)
    return
  }

  ensureDir(destDir)

  // Create package index with README content
  const readmePath = Path.join(ROOT, "packages", dirName, "README.md")
  let readmeContent = ""
  if (Fs.existsSync(readmePath)) {
    readmeContent = Fs.readFileSync(readmePath, "utf8")
    // Strip the first H1 line (redundant with the page title)
    readmeContent = readmeContent.replace(/^# .+\n+/, "")
    // Strip badges block (lines that are only badge images/links)
    readmeContent = readmeContent.replace(/^(\[!\[.*?\].*?\n)+\n*/m, "")
  }

  Fs.writeFileSync(
    Path.join(destDir, "index.md"),
    [
      "---",
      `title: "${displayName}"`,
      "has_children: true",
      `nav_order: ${navOrder}`,
      "---",
      "",
      `# ${displayName}`,
      "",
      ...(readmeContent ? [readmeContent] : []),
      ""
    ].join("\n")
  )

  // Collect all directories and create intermediate navigation pages
  const dirs = collectDirs(pkgDocsModules)

  // Sort dirs so parents are created before children
  dirs.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))

  // Track dir → title mapping for parent references
  /** @type {Map<string, string>} relPath → title */
  const dirTitleMap = new Map()
  // Track dir → parent title for grand_parent references
  /** @type {Map<string, string>} relPath → parentTitle */
  const dirParentMap = new Map()

  let dirNavOrder = 1
  for (const relDir of dirs) {
    const parts = relDir.split("/")
    const dirBasename = parts[parts.length - 1]
    const title = dirBasename

    let parentTitle
    let grandParentTitle

    if (parts.length === 1) {
      // Top-level directory under package
      parentTitle = displayName
      grandParentTitle = undefined
    } else {
      // Nested directory - parent is the enclosing directory
      const parentRelDir = parts.slice(0, -1).join("/")
      parentTitle = dirTitleMap.get(parentRelDir) || parentRelDir
      // If the parent title is ambiguous, set grand_parent
      if (ambiguousDirNames.has(parentTitle)) {
        grandParentTitle = dirParentMap.get(parentRelDir)
      }
    }

    dirTitleMap.set(relDir, title)
    dirParentMap.set(relDir, parentTitle)

    const destPath = Path.join(destDir, relDir, "index.md")
    createDirGroupPage(destPath, title, parentTitle, grandParentTitle, dirNavOrder++)
  }

  // Build per-package symbol index for {@link} resolution
  const symbolIndex = buildSymbolIndex(pkgDocsModules)

  // Now process all .md module files
  processModuleFiles(pkgDocsModules, destDir, displayName, dirTitleMap, dirParentMap, ambiguousDirNames, "", dirName, symbolIndex)

  const count = Fs.readdirSync(pkgDocsModules, { recursive: true })
    .filter((f) => String(f).endsWith(".md") && String(f) !== "index.md").length
  console.log(`✓ ${displayName}: ${count} module docs, ${dirs.length} directory groups`)
}

/**
 * Recursively process module .md files, rewriting their parent/grand_parent.
 */
function processModuleFiles(srcDir, destDir, packageDisplayName, dirTitleMap, dirParentMap, ambiguousDirNames, relPrefix, pkgDirName, symbolIndex) {
  if (!Fs.existsSync(srcDir)) return

  const entries = Fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = Path.join(srcDir, entry.name)
    const destPath = Path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      ensureDir(destPath)
      const childRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name
      processModuleFiles(srcPath, destPath, packageDisplayName, dirTitleMap, dirParentMap, ambiguousDirNames, childRel, pkgDirName, symbolIndex)
    } else if (entry.name === "index.md") {
      // Skip docgen's "Modules" index — we create our own
      continue
    } else if (entry.name === "index.ts.md" && isPureBarrel(srcPath)) {
      // Skip pure barrel files (only re-exports, no real API signatures)
      continue
    } else if (entry.name.endsWith(".md")) {
      // Determine the parent for this file
      let parentTitle
      let grandParentTitle

      if (relPrefix) {
        // File is inside a directory group
        parentTitle = dirTitleMap.get(relPrefix) || relPrefix
        // If parent title is ambiguous, set grand_parent
        if (ambiguousDirNames.has(parentTitle)) {
          grandParentTitle = dirParentMap.get(relPrefix)
        }
      } else {
        // File is at the root of the package modules
        parentTitle = packageDisplayName
        grandParentTitle = undefined
      }

      // Extract just the filename as the display title
      const leafTitle = entry.name.replace(/\.md$/, "")

      rewriteModulePage(srcPath, destPath, parentTitle, grandParentTitle, leafTitle, pkgDirName, symbolIndex)
    }
  }
}

/** Read a one-line description from a package's package.json */
function getPackageDescription(dirName) {
  const pkgJsonPath = Path.join(ROOT, "packages", dirName, "package.json")
  if (Fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(Fs.readFileSync(pkgJsonPath, "utf8"))
      if (pkg.description) return pkg.description
    } catch { /* ignore */ }
  }
  return ""
}

// --- Main execution ---

// Clean docs/ output (preserve infrastructure files)
if (Fs.existsSync(DOCS_OUT)) {
  const entries = Fs.readdirSync(DOCS_OUT, { withFileTypes: true })
  for (const entry of entries) {
    if (PRESERVE.has(entry.name)) continue
    const fullPath = Path.join(DOCS_OUT, entry.name)
    Fs.rmSync(fullPath, { recursive: true, force: true })
  }
}
ensureDir(DOCS_OUT)

// Scan for ambiguous directory names across all packages
const ambiguousDirNames = findAmbiguousDirNames()
if (ambiguousDirNames.size > 0) {
  console.log(`ℹ Ambiguous directory names (will use grand_parent): ${[...ambiguousDirNames].join(", ")}`)
}

// Create root index
Fs.writeFileSync(
  Path.join(DOCS_OUT, "index.md"),
  [
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
    ...PACKAGES.map(
      ([dir, name, , col]) => `- [**${name}**](/${col}/${dir}/) — ${getPackageDescription(dir)}`
    ),
    ""
  ].join("\n")
)

// Process each package
for (const [dirName, displayName, navOrder, collection] of PACKAGES) {
  processPackage(dirName, displayName, navOrder, collection, ambiguousDirNames)
}

console.log("\nDocs aggregation complete → docs/")
