import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"

const PACKAGES_DIRECTORY = "packages"
const MANIFEST_FILE = "package.json"
const RELEASE_SNAPSHOT_STAMP_SCRIPT = "release-snapshots:stamp"

const packageManifests = () =>
  readdirSync(PACKAGES_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES_DIRECTORY, entry.name))
    .flatMap((packageRoot) => {
      const manifestPath = join(packageRoot, MANIFEST_FILE)

      if (!existsSync(manifestPath)) {
        return []
      }

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

      return [
        {
          packageRoot,
          packageName: typeof manifest.name === "string" ? manifest.name : packageRoot,
          version: typeof manifest.version === "string" ? manifest.version : "",
          hasReleaseSnapshotStamp: typeof manifest.scripts?.[RELEASE_SNAPSHOT_STAMP_SCRIPT] === "string"
        }
      ]
    })

const manifestsByRoot = (manifests) => new Map(manifests.map((manifest) => [manifest.packageRoot, manifest]))

const beforeVersion = manifestsByRoot(packageManifests())

execFileSync("bun", ["run", "changeset", "version"], { stdio: "inherit" })

const changedGovernedPackages = packageManifests()
  .filter((manifest) => {
    const previous = beforeVersion.get(manifest.packageRoot)

    return previous !== undefined && previous.version !== manifest.version && manifest.hasReleaseSnapshotStamp
  })
  .sort((left, right) => left.packageRoot.localeCompare(right.packageRoot))

if (changedGovernedPackages.length === 0) {
  process.stdout.write("[release-snapshots] no governed package versions changed during changeset versioning\n")
  process.exit(0)
}

for (const manifest of changedGovernedPackages) {
  process.stdout.write(`[release-snapshots] stamping ${manifest.packageName}@${manifest.version}\n`)
  execFileSync("bun", ["run", RELEASE_SNAPSHOT_STAMP_SCRIPT], {
    cwd: manifest.packageRoot,
    stdio: "inherit"
  })
}
