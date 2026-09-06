import { Option } from "effect"
import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

import type { DocsManifest, DocsPackageSummary } from "@theoria/docs-model"
import { docsPathFor, type DocsRoute } from "../../../contracts/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Main, Section, Stack } from "../primitives/Layout.js"
import { DocsHeader } from "./DocsHeader.js"
import { DocsNavigation } from "./DocsNavigation.js"
import { DocsNavigationDrawer } from "./DocsNavigationDrawer.js"
import { DocsOnThisPage, type DocsPageAnchor } from "./DocsOnThisPage.js"
import { DocsSearchDialog } from "./DocsSearchDialog.js"

export const DocsRouteEntrance = (
  { children, className }: { readonly children: ReactNode; readonly className: string }
) => {
  const reducedMotion = useReducedMotion()

  return (
    <Layer
      className={className}
      render={
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={reducedMotion === true ? false : { opacity: 0, y: 6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        />
      }
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
    <Main className={`${docsTheme.main} outline-none`} data-route-focus tabIndex={-1}>
      <DocsRouteEntrance className={docsTheme.article} key={docsPathFor(route)}>{children}</DocsRouteEntrance>
    </Main>
    <Section aria-label="Page outline" render={<aside />} className={docsTheme.toc}>
      <Layer className={docsTheme.tocSticky}>
        <DocsOnThisPage anchors={anchors} />
      </Layer>
    </Section>
  </>
)
