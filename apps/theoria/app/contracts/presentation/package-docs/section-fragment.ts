import type { PackageName } from "./shared.js"

import { PackageDocsPackagePageRoute } from "./page-route.js"

const packageDocsReadableFragmentPart = (value: string): string =>
  value
    .trim()
    .replace(/([a-z\d])([A-Z])/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "")
    .replace(/-{2,}/gu, "-") || "root"

const packageDocsReadableSourcePath = (value: string): string =>
  value.startsWith("packages/") ? value.slice("packages/".length) : value

export const packageDocsSectionFragmentId = (input: {
  readonly sourceAnchor: string | null
  readonly sourcePath: string
}): string =>
  `package-doc-section-${
    packageDocsReadableFragmentPart(
      packageDocsReadableSourcePath(input.sourcePath)
    )
  }--${packageDocsReadableFragmentPart(input.sourceAnchor ?? "root")}`

export const packageDocsSectionHref = (input: {
  readonly fragmentId: string
  readonly packageId: PackageName
}): string => `${PackageDocsPackagePageRoute.fromPackageId(input.packageId).path()}#${input.fragmentId}`
