import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as m from "motion/react-m"
import type { ReactNode } from "react"

import type { DocsManifest, DocsPackageSummary } from "@theoria/docs-model"
import { docsPathFor, type DocsRoute } from "../../../contracts/docs.js"
import { motionPreferenceAtom } from "../../atoms/motion.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Main, Section, Stack } from "../primitives/Layout.js"
import { arrivedAt, routeEntranceInitial } from "../primitives/motion.js"
import { DocsHeader } from "./DocsHeader.js"
import { DocsNavigation } from "./DocsNavigation.js"
import { DocsNavigationDrawer } from "./DocsNavigationDrawer.js"
import { DocsOnThisPage, type DocsPageAnchor } from "./DocsOnThisPage.js"
import { DocsSearchDialog } from "./DocsSearchDialog.js"

/**
 * A route's content arriving: it rises in over the theme's `enter`, or under
 * reduced motion stands where it lands from the first frame. The preference
 * comes from `motionPreferenceAtom`, the page's one source for it.
 */
export const DocsRouteEntrance = (
  { children, className }: { readonly children: ReactNode; readonly className: string }
) => {
  const preference = useAtomValue(motionPreferenceAtom)

  return (
    <Layer
      className={className}
      data-route-entrance
      render={<m.div animate={arrivedAt} initial={routeEntranceInitial(preference)} />}
    >
      {children}
    </Layer>
  )
}

export const DocsPackageShell = ({
  children,
  docsPackage,
  manifest,
  route
}: {
  readonly children: ReactNode
  readonly docsPackage: DocsPackageSummary
  readonly manifest: DocsManifest
  readonly route: DocsRoute
}) => (
  <Layer className={docsTheme.root}>
    <DocsHeader activePackage={Option.some(docsPackage)} packages={manifest.packages} />
    <Layer className={docsTheme.workbench}>
      <Section aria-label="Documentation navigation" render={<aside />} className={docsTheme.sidebar}>
        <Stack className={docsTheme.sidebarSticky} key={docsPackage.slug}>
          <DocsNavigation docsPackage={docsPackage} route={route} />
        </Stack>
      </Section>
      {children}
    </Layer>
    <DocsNavigationDrawer docsPackage={docsPackage} manifest={manifest} route={route} />
    <DocsSearchDialog activePackageSlug={Option.some(docsPackage.slug)} manifest={manifest} />
  </Layer>
)

export const DocsResourceFrame = ({
  anchors,
  children,
  route
}: {
  readonly anchors: ReadonlyArray<DocsPageAnchor>
  readonly children: ReactNode
  readonly route: DocsRoute
}) => (
  <>
    <Main className={`${docsTheme.main} ${docsTheme.routeFocus}`} data-route-focus tabIndex={-1}>
      <DocsRouteEntrance className={docsTheme.article} key={docsPathFor(route)}>{children}</DocsRouteEntrance>
    </Main>
    <Section aria-label="Page outline" render={<aside />} className={docsTheme.toc}>
      <Layer className={docsTheme.tocSticky}>
        <DocsOnThisPage anchors={anchors} />
      </Layer>
    </Section>
  </>
)
