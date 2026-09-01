import { Result } from "@effect-atom/atom"
import { useAtomRefresh, useAtomValue } from "@effect-atom/atom-react"
import * as Arr from "effect/Array"
import type { ReactNode } from "react"

import type { ApiPage, DocsManifest, DocsPackageSummary, GuidePage } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsApiPageAtom, docsGuidePageAtom } from "../../atoms/docs-data.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Main, Section, Stack } from "../primitives/Layout.js"
import { apiCategoryAnchor, ApiPageView } from "./ApiPageView.js"
import { DocsHeader } from "./DocsHeader.js"
import { DocsNavigation } from "./DocsNavigation.js"
import { DocsNavigationDrawer } from "./DocsNavigationDrawer.js"
import { DocsOnThisPage, type DocsPageAnchor } from "./DocsOnThisPage.js"
import { DocsSearchDialog } from "./DocsSearchDialog.js"
import { DocsStatus } from "./DocsStatus.js"
import { GuidePageView } from "./GuidePageView.js"

const DocsWorkbench = ({
  anchors,
  children,
  docsPackage,
  manifest,
  route
}: {
  readonly anchors: ReadonlyArray<DocsPageAnchor>
  readonly children: ReactNode
  readonly docsPackage: DocsPackageSummary
  readonly manifest: DocsManifest
  readonly route: DocsRoute
}) => (
  <Layer className={docsTheme.root}>
    <DocsHeader activePackage={docsPackage} packages={manifest.packages} />
    <Layer className={docsTheme.workbench}>
      <Section as="aside" className={docsTheme.sidebar}>
        <Stack className={docsTheme.sidebarSticky}>
          <DocsNavigation docsPackage={docsPackage} route={route} />
        </Stack>
      </Section>
      <Main className={docsTheme.main}>
        <Layer className={docsTheme.article}>{children}</Layer>
      </Main>
      <Section as="aside" className={docsTheme.toc}>
        <Layer className={docsTheme.tocSticky}>
          <DocsOnThisPage anchors={anchors} />
        </Layer>
      </Section>
    </Layer>
    <DocsNavigationDrawer docsPackage={docsPackage} manifest={manifest} route={route} />
    <DocsSearchDialog activePackageSlug={docsPackage.slug} manifest={manifest} />
  </Layer>
)

const guideAnchors = (page: GuidePage): ReadonlyArray<DocsPageAnchor> =>
  Arr.map(page.anchors, (anchor): DocsPageAnchor => [anchor.id, anchor.label])

const apiAnchors = (page: ApiPage): ReadonlyArray<DocsPageAnchor> =>
  Arr.map(page.categories, (category): DocsPageAnchor => [apiCategoryAnchor(category.name), category.name])

export const GuideResource = ({
  asset,
  docsPackage,
  manifest,
  route
}: {
  readonly asset: string
  readonly docsPackage: DocsPackageSummary
  readonly manifest: DocsManifest
  readonly route: DocsRoute
}) => {
  const atom = docsGuidePageAtom(asset)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.match(result, {
    onInitial: () => (
      <DocsWorkbench anchors={[]} docsPackage={docsPackage} manifest={manifest} route={route}>
        <DocsStatus retry={refresh} state="loading" />
      </DocsWorkbench>
    ),
    onFailure: () => (
      <DocsWorkbench anchors={[]} docsPackage={docsPackage} manifest={manifest} route={route}>
        <DocsStatus retry={refresh} state="failure" />
      </DocsWorkbench>
    ),
    onSuccess: ({ value }) => (
      <DocsWorkbench anchors={guideAnchors(value)} docsPackage={docsPackage} manifest={manifest} route={route}>
        <GuidePageView page={value} />
      </DocsWorkbench>
    )
  })
}

export const ApiResource = ({
  asset,
  docsPackage,
  manifest,
  route
}: {
  readonly asset: string
  readonly docsPackage: DocsPackageSummary
  readonly manifest: DocsManifest
  readonly route: DocsRoute
}) => {
  const atom = docsApiPageAtom(asset)
  const result = useAtomValue(atom)
  const refresh = useAtomRefresh(atom)

  return Result.match(result, {
    onInitial: () => (
      <DocsWorkbench anchors={[]} docsPackage={docsPackage} manifest={manifest} route={route}>
        <DocsStatus retry={refresh} state="loading" />
      </DocsWorkbench>
    ),
    onFailure: () => (
      <DocsWorkbench anchors={[]} docsPackage={docsPackage} manifest={manifest} route={route}>
        <DocsStatus retry={refresh} state="failure" />
      </DocsWorkbench>
    ),
    onSuccess: ({ value }) => (
      <DocsWorkbench anchors={apiAnchors(value)} docsPackage={docsPackage} manifest={manifest} route={route}>
        <ApiPageView page={value} />
      </DocsWorkbench>
    )
  })
}
