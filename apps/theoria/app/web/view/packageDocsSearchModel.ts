import type { PackageDocsSearchResult } from "../../contracts/presentation/package-docs.js"
import {
  packageDocsPackagePageRoute,
  packageDocsPagePath,
  PackageDocsSearchModel,
  PackageDocsSearchResultItem,
  packageDocsSearchScopeDescription,
  packageDocsSearchScopeLabel
} from "../../contracts/presentation/package-docs.js"

const repositorySourceHref = (path: string): string => `https://github.com/scenesystems/theoria/blob/main/${path}`

const resultSummaryText = ({
  query,
  resultCount,
  scopeLabel
}: {
  readonly query: string
  readonly resultCount: number
  readonly scopeLabel: string
}): string =>
  resultCount === 0
    ? `No sections matched "${query}" in ${scopeLabel.toLowerCase()}.`
    : `${resultCount} match${resultCount === 1 ? "" : "es"} for "${query}" in ${scopeLabel.toLowerCase()}.`

export const packageDocsSearchModel = ({
  packageId,
  query,
  results
}: {
  readonly packageId: PackageDocsSearchResult["packageId"] | null
  readonly query: string
  readonly results: ReadonlyArray<PackageDocsSearchResult>
}): PackageDocsSearchModel => {
  const scopeLabel = packageDocsSearchScopeLabel(packageId)

  return PackageDocsSearchModel.make({
    query,
    resultSummary: resultSummaryText({ query, resultCount: results.length, scopeLabel }),
    results: results.map((result) =>
      PackageDocsSearchResultItem.make({
        excerpt: result.excerpt,
        href: packageDocsPagePath(packageDocsPackagePageRoute(result.packageId)),
        packageId: result.packageId,
        sourceHref: repositorySourceHref(result.source.path),
        sourceLabel: result.source.path,
        title: result.title
      })
    ),
    scopeDescription: packageDocsSearchScopeDescription(packageId),
    scopeLabel
  })
}
