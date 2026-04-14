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

export class PackageDocsSearchOpenEmptyContent extends Schema.TaggedClass<PackageDocsSearchOpenEmptyContent>()(
  "OpenEmpty",
  {
    frame: PackageDocsSearchPanelFrame,
    model: PackageDocsSearchModel
  }
) {}

export class PackageDocsSearchLoadingInitialContent
  extends Schema.TaggedClass<PackageDocsSearchLoadingInitialContent>()(
    "LoadingInitial",
    {
      frame: PackageDocsSearchPanelFrame,
      statusText: Schema.String
    }
  )
{}

export class PackageDocsSearchRefreshingStaleContent
  extends Schema.TaggedClass<PackageDocsSearchRefreshingStaleContent>()(
    "RefreshingStale",
    {
      frame: PackageDocsSearchPanelFrame,
      model: PackageDocsSearchModel,
      statusText: Schema.String
    }
  )
{}

export class PackageDocsSearchErrorEmptyContent extends Schema.TaggedClass<PackageDocsSearchErrorEmptyContent>()(
  "ErrorEmpty",
  {
    description: Schema.String,
    frame: PackageDocsSearchPanelFrame
  }
) {}

export class PackageDocsSearchErrorWithStaleContent
  extends Schema.TaggedClass<PackageDocsSearchErrorWithStaleContent>()(
    "ErrorWithStale",
    {
      description: Schema.String,
      frame: PackageDocsSearchPanelFrame,
      model: PackageDocsSearchModel
    }
  )
{}

export class PackageDocsSearchReadyContent extends Schema.TaggedClass<PackageDocsSearchReadyContent>()("Ready", {
  frame: PackageDocsSearchPanelFrame,
  model: PackageDocsSearchModel
}) {}

export const PackageDocsSearchPanelContent = Schema.Union(
  PackageDocsSearchOpenEmptyContent,
  PackageDocsSearchLoadingInitialContent,
  PackageDocsSearchRefreshingStaleContent,
  PackageDocsSearchErrorEmptyContent,
  PackageDocsSearchErrorWithStaleContent,
  PackageDocsSearchReadyContent
)

export type PackageDocsSearchPanelContent = typeof PackageDocsSearchPanelContent.Type

const packageDocsSearchPanelFrame = () =>
  PackageDocsSearchPanelFrame.make({
    placeholderText: "Search guides, examples, release history, and verification commands...",
    summaryText: "Find the package knowledge behind Theoria's studies without leaving the current guide.",
    title: "Search the package library"
  })

export const packageDocsSearchPanelContent = (input: {
  readonly emptyModel: PackageDocsSearchModel
  readonly previousModel: PackageDocsSearchModel | null
  readonly readyModel: PackageDocsSearchModel | null
  readonly state: PackageDocsSearchState
}): PackageDocsSearchPanelContent => {
  const frame = packageDocsSearchPanelFrame()

  return Match.value(input.state).pipe(
    Match.tag("IdlePackageDocsSearch", () =>
      PackageDocsSearchOpenEmptyContent.make({
        frame,
        model: input.emptyModel
      })),
    Match.tag("LoadingPackageDocsSearch", () =>
      input.previousModel === null
        ? PackageDocsSearchLoadingInitialContent.make({
          frame,
          statusText: "Searching the package library..."
        })
        : PackageDocsSearchRefreshingStaleContent.make({
          frame,
          model: input.previousModel,
          statusText: "Refreshing package docs results..."
        })),
    Match.tag("FailedPackageDocsSearch", ({ description }) =>
      input.previousModel === null
        ? PackageDocsSearchErrorEmptyContent.make({
          description,
          frame
        })
        : PackageDocsSearchErrorWithStaleContent.make({
          description,
          frame,
          model: input.previousModel
        })),
    Match.tag("ReadyPackageDocsSearch", () =>
      PackageDocsSearchReadyContent.make({
        frame,
        model: input.readyModel ?? input.emptyModel
      })),
    Match.exhaustive
  )
}
