/**
 * resolve-workspace-deps.ts
 *
 * Resolves `workspace:` protocol references in a packed package.json to real
 * semver ranges. Runs after `build-utils pack-v3` which copies dependencies
 * verbatim from the source package.json into dist/package.json.
 *
 * The workspace: protocol is understood by bun/pnpm during local development
 * but `changeset publish` calls `npm publish` internally, which does not
 * rewrite these references. This script bridges that gap.
 *
 * Mapping rules (matching bun/pnpm publish behavior):
 *   workspace:^  → ^{version}
 *   workspace:~  → ~{version}
 *   workspace:*  → ^{version}   (caret range — safest default for *)
 *
 * Usage:
 *   bun run scripts/resolve-workspace-deps.ts [--check]
 *
 * --check: verify dist/package.json has no workspace: references (for CI),
 *          exits non-zero if any remain.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const PACKAGES_DIR = join(ROOT, "packages")
const CHECK_MODE = process.argv.includes("--check")

// ---------------------------------------------------------------------------
// 1. Build a map of workspace package name → version
// ---------------------------------------------------------------------------
function buildVersionMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgPath = join(PACKAGES_DIR, entry.name, "package.json")
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
    if (pkg.name && pkg.version) {
      map.set(pkg.name, pkg.version)
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// 2. Resolve a single workspace: specifier to a real semver range
// ---------------------------------------------------------------------------
function resolveSpec(spec: string, depName: string, versions: Map<string, string>): string {
  if (!spec.startsWith("workspace:")) return spec

  const version = versions.get(depName)
  if (!version) {
    throw new Error(
      `Cannot resolve workspace dependency "${depName}": not found in packages/. ` +
      `Known packages: ${[...versions.keys()].join(", ")}`
    )
  }

  const protocol = spec.slice("workspace:".length)
  switch (protocol) {
    case "^": return `^${version}`
    case "~": return `~${version}`
    case "*": return `^${version}`
    default:
      throw new Error(
        `Unsupported workspace protocol "${spec}" for "${depName}". ` +
        `Supported: workspace:^, workspace:~, workspace:*`
      )
  }
}

// ---------------------------------------------------------------------------
// 3. Process a single dist/package.json
// ---------------------------------------------------------------------------
function processPackage(pkgDir: string, versions: Map<string, string>): { name: string; resolved: number; errors: Array<string> } {
  const distPkgPath = join(pkgDir, "dist", "package.json")
  if (!existsSync(distPkgPath)) {
    return { name: pkgDir, resolved: 0, errors: [] }
  }

  const pkg = JSON.parse(readFileSync(distPkgPath, "utf-8"))
  const errors: Array<string> = []
  let resolved = 0

  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const deps = pkg[field]
    if (!deps || typeof deps !== "object") continue
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== "string" || !spec.startsWith("workspace:")) continue
      if (CHECK_MODE) {
        errors.push(`${pkg.name} ${field}.${name}: ${spec}`)
      } else {
        try {
          pkg[field][name] = resolveSpec(spec, name, versions)
          resolved++
        } catch (e) {
          errors.push((e as Error).message)
        }
      }
    }
  }

  if (!CHECK_MODE && resolved > 0) {
    writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2) + "\n")
  }

  return { name: pkg.name || pkgDir, resolved, errors }
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------
const versions = buildVersionMap()
let totalResolved = 0
let totalErrors = 0

for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const pkgDir = join(PACKAGES_DIR, entry.name)
  const result = processPackage(pkgDir, versions)

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`  ✗ ${err}`)
    }
    totalErrors += result.errors.length
  }
  if (result.resolved > 0) {
    console.log(`  ✓ ${result.name}: resolved ${result.resolved} workspace dep(s)`)
    totalResolved += result.resolved
  }
}

if (CHECK_MODE) {
  if (totalErrors > 0) {
    console.error(`\n✗ Found ${totalErrors} unresolved workspace: reference(s) in dist/`)
    process.exit(1)
  } else {
    console.log("✓ No workspace: references in dist/")
  }
} else {
  if (totalErrors > 0) {
    console.error(`\n✗ ${totalErrors} error(s) resolving workspace deps`)
    process.exit(1)
  }
  console.log(`\n✓ Resolved ${totalResolved} workspace dep(s) across all packages`)
}
