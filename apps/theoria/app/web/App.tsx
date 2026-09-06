import { Tooltip } from "@base-ui/react/tooltip"
import { RegistryProvider, useAtomMount, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import { MotionConfig } from "motion/react"

import { browserMetadataMountAtom, browserNavigationMountAtom, pageRouteAtom } from "./atoms/navigation.js"
import { colorModeApplicationAtom } from "./atoms/theme.js"
import { DocsPage } from "./view/docs/DocsPage.js"
import { HomePage } from "./view/home/HomePage.js"

import "./styles.css"

const AppShell = () => {
  // Read, not mounted: the navigation atom must set the route during this render, before `pageRouteAtom` is read.
  useAtomValue(browserNavigationMountAtom)
  useAtomMount(browserMetadataMountAtom)
  useAtomMount(colorModeApplicationAtom)
  const route = useAtomValue(pageRouteAtom)

  return Match.value(route).pipe(
    Match.tag("HomeRoute", () => <HomePage />),
    Match.tag("DocsIndexRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsOverviewRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsGuideRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsApiRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsNotFoundRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.exhaustive
  )
}

/** Motion follows the reader's reduced-motion setting; Base UI tooltips share one provider so they hand off without delay. */
export const App = () => (
  <RegistryProvider defaultIdleTTL={400}>
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider>
        <AppShell />
      </Tooltip.Provider>
    </MotionConfig>
  </RegistryProvider>
)
