import { Match, Schema } from "effect"

import { PackageDocsSearchModel } from "./search-model.js"
import type { PackageDocsSearchState } from "./search-state.js"

export class PackageDocsSearchPanelFrame extends Schema.Class<PackageDocsSearchPanelFrame>(
  "PackageDocsSearchPanelFrame"
)({
  placeholderText: Schema.String,
  summaryText: Schema.String,
  title: Schema.String
}) {}

export class PackageDocsSearchIdleContent extends Schema.TaggedClass<PackageDocsSearchIdleContent>()("Idle", {
  frame: PackageDocsSearchPanelFrame,
  model: PackageDocsSearchModel
}) {}

export class PackageDocsSearchLoadingContent extends Schema.TaggedClass<PackageDocsSearchLoadingContent>()(
  "Loading",
  {
    frame: PackageDocsSearchPanelFrame,
    statusText: Schema.String
  }
) {}

export class PackageDocsSearchFailureContent extends Schema.TaggedClass<PackageDocsSearchFailureContent>()(
  "Failure",
  {
    description: Schema.String,
    frame: PackageDocsSearchPanelFrame
  }
) {}

export class PackageDocsSearchReadyContent extends Schema.TaggedClass<PackageDocsSearchReadyContent>()("Ready", {
  frame: PackageDocsSearchPanelFrame,
  model: PackageDocsSearchModel
}) {}

export const PackageDocsSearchPanelContent = Schema.Union(
  PackageDocsSearchIdleContent,
  PackageDocsSearchLoadingContent,
  PackageDocsSearchFailureContent,
  PackageDocsSearchReadyContent
)

export type PackageDocsSearchPanelContent = typeof PackageDocsSearchPanelContent.Type

const packageDocsSearchPanelFrame = () =>
  PackageDocsSearchPanelFrame.make({
    placeholderText: "Search README blocks, module docs, examples, snapshots, and proof commands...",
    summaryText: "Search the canonical package-doc corpus without leaving the current docs surface.",
    title: "Search docs"
  })

export const packageDocsSearchPanelContent = (state: PackageDocsSearchState): PackageDocsSearchPanelContent => {
  const frame = packageDocsSearchPanelFrame()

  return Match.value(state).pipe(
    Match.tag("IdlePackageDocsSearch", ({ selectedPackageId }) =>
      PackageDocsSearchIdleContent.make({
        frame,
        model: PackageDocsSearchModel.project({
          packageId: selectedPackageId,
          query: "",
          results: []
        })
      })),
    Match.tag("LoadingPackageDocsSearch", () =>
      PackageDocsSearchLoadingContent.make({
        frame,
        statusText: "Searching package docs..."
      })),
    Match.tag("FailedPackageDocsSearch", ({ description }) =>
      PackageDocsSearchFailureContent.make({
        description,
        frame
      })),
    Match.tag("ReadyPackageDocsSearch", ({ query, results, selectedPackageId }) =>
      PackageDocsSearchReadyContent.make({
        frame,
        model: PackageDocsSearchModel.project({
          packageId: selectedPackageId,
          query,
          results
        })
      })),
    Match.exhaustive
  )
}
