import { useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { metadataForPackageDocs } from "../../../contracts/presentation/metadata.js"
import {
  packageDocsPresentationCopy,
  type PackageDocsPageRoute,
  packageDocsSelectedPackageId
} from "../../../contracts/presentation/package-docs.js"
import { packageDocsRouteStateAtom } from "../../atoms/package-docs-route.js"
import { app } from "../primitives/theme/surface.js"
import { DocumentHead } from "../primitives/DocumentHead.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { FailureState, RunningState } from "../primitives/Skeleton.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"
import { packageDocsNavigationModel, packageDocsPageModel } from "../packageDocsModel.js"
import { PackageDocsCatalogNavigation } from "./PackageDocsCatalogNavigation.js"
import { PackageDocsFailureState } from "./PackageDocsFailureState.js"
import { PackageDocsOverview } from "./PackageDocsOverview.js"
import { PackageDocsSearchPanel } from "./PackageDocsSearchPanel.js"
import { PackageDocsSectionGroups } from "./PackageDocsSectionGroups.js"

const PackageDocsContent = ({ route }: { readonly route: PackageDocsPageRoute }) => {
  const state = useAtomValue(packageDocsRouteStateAtom(route))

  return Match.value(state).pipe(
    Match.tag("CatalogLoading", () => <RunningState text="Loading package docs catalog…" />),
    Match.tag("CatalogFailure", ({ description }) => <FailureState description={description} />),
    Match.tag("EmptyCatalog", () => <FailureState description="Package docs catalog is empty." />),
    Match.tag("BundleLoading", ({ catalog, selectedPackageId }) => (
      <Stack className="gap-6">
        <PackageDocsSearchPanel route={route} />
        <PackageDocsCatalogNavigation
          items={packageDocsNavigationModel({ catalog, selectedPackageId })}
          title={packageDocsPresentationCopy.navigationTitle}
        />
        <RunningState text="Loading package docs bundle…" />
      </Stack>
    )),
    Match.tag("BundleFailure", ({ catalog, description, selectedPackageId }) => (
      <Stack className="gap-6">
        <PackageDocsSearchPanel route={route} />
        <PackageDocsFailureState
          description={description}
          navigation={packageDocsNavigationModel({ catalog, selectedPackageId })}
          navigationTitle={packageDocsPresentationCopy.navigationTitle}
        />
      </Stack>
    )),
    Match.tag("Ready", ({ bundle, catalog, selectedPackageId }) => {
      const model = packageDocsPageModel({ bundle, catalog, selectedPackageId })

      return (
        <Stack className="gap-6">
          <PackageDocsSearchPanel route={route} />
          <PackageDocsOverview model={model} />
          <PackageDocsCatalogNavigation
            items={model.navigation}
            title={packageDocsPresentationCopy.navigationTitle}
          />
          <PackageDocsSectionGroups groups={model.groups} />
        </Stack>
      )
    }),
    Match.exhaustive
  )
}

export const PackageDocsPage = ({ route }: { readonly route: PackageDocsPageRoute }) => (
  <>
    <DocumentHead metadata={metadataForPackageDocs(packageDocsSelectedPackageId(route))} />

    <Layer as="main" className={app.root}>
      <Layer aria-hidden className={app.atmosphericGlowA} />
      <Layer aria-hidden className={app.atmosphericGlowB} />

      <Layer className={app.content}>
        <SiteHeader />
        <PackageDocsContent route={route} />
        <SiteFooter />
      </Layer>
    </Layer>
  </>
)
