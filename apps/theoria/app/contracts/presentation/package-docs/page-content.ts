import { Match, Schema } from "effect"

import { PackageDocsGroup, PackageDocsNavigationItem, PackageDocsPageModel } from "./page-model.js"
import { PackageDocsPresentation } from "./presentation.js"
import type { PackageDocsRouteState } from "./route-state.js"

export class PackageDocsSearchPanelSection extends Schema.TaggedClass<PackageDocsSearchPanelSection>()(
  "SearchPanel",
  {}
) {}

export class PackageDocsRunningStateSection extends Schema.TaggedClass<PackageDocsRunningStateSection>()(
  "RunningState",
  {
    text: Schema.String
  }
) {}

export class PackageDocsFailureStateSection extends Schema.TaggedClass<PackageDocsFailureStateSection>()(
  "FailureState",
  {
    description: Schema.String
  }
) {}

export class PackageDocsNavigationSection extends Schema.TaggedClass<PackageDocsNavigationSection>()(
  "Navigation",
  {
    items: Schema.Array(PackageDocsNavigationItem),
    title: Schema.String
  }
) {}

export class PackageDocsOverviewSection extends Schema.TaggedClass<PackageDocsOverviewSection>()("Overview", {
  model: PackageDocsPageModel
}) {}

export class PackageDocsSectionGroupsSection extends Schema.TaggedClass<PackageDocsSectionGroupsSection>()(
  "SectionGroups",
  {
    groups: Schema.Array(PackageDocsGroup)
  }
) {}

export const PackageDocsPageSection = Schema.Union(
  PackageDocsSearchPanelSection,
  PackageDocsRunningStateSection,
  PackageDocsFailureStateSection,
  PackageDocsNavigationSection,
  PackageDocsOverviewSection,
  PackageDocsSectionGroupsSection
)

export class PackageDocsPageContent extends Schema.Class<PackageDocsPageContent>("PackageDocsPageContent")({
  sections: Schema.Array(PackageDocsPageSection)
}) {}

const navigationTitle = PackageDocsPresentation.navigationTitle()

export namespace PackageDocsPageContent {
  export const project = (state: PackageDocsRouteState.Value): PackageDocsPageContent =>
    PackageDocsPageContent.make({
      sections: Match.value(state).pipe(
        Match.tag(
          "CatalogLoading",
          () => [PackageDocsRunningStateSection.make({ text: "Loading the package library…" })]
        ),
        Match.tag("CatalogFailure", ({ description }) => [PackageDocsFailureStateSection.make({ description })]),
        Match.tag(
          "EmptyCatalog",
          () => [PackageDocsFailureStateSection.make({ description: "The package library is empty." })]
        ),
        Match.tag("BundleLoading", ({ catalog, selectedPackageId }) => [
          PackageDocsSearchPanelSection.make({}),
          PackageDocsNavigationSection.make({
            items: PackageDocsNavigationItem.projectCatalog({ catalog, selectedPackageId }),
            title: navigationTitle
          }),
          PackageDocsRunningStateSection.make({ text: "Loading this package guide…" })
        ]),
        Match.tag("BundleFailure", ({ catalog, description, selectedPackageId }) => [
          PackageDocsSearchPanelSection.make({}),
          PackageDocsNavigationSection.make({
            items: PackageDocsNavigationItem.projectCatalog({ catalog, selectedPackageId }),
            title: navigationTitle
          }),
          PackageDocsFailureStateSection.make({ description })
        ]),
        Match.tag("Ready", ({ bundle, catalog, selectedPackageId }) => {
          const model = PackageDocsPageModel.project({ bundle, catalog, selectedPackageId })

          return [
            PackageDocsSearchPanelSection.make({}),
            PackageDocsOverviewSection.make({ model }),
            PackageDocsNavigationSection.make({
              items: model.navigation,
              title: navigationTitle
            }),
            PackageDocsSectionGroupsSection.make({ groups: model.groups })
          ]
        }),
        Match.exhaustive
      )
    })
}
