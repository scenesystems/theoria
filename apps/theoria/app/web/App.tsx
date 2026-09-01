import { Tooltip } from "@base-ui-components/react/tooltip"
import { RegistryProvider, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { preloadRouteKey, routePreloadMountAtom } from "./atoms/preload.js"
import { type ColorMode, colorModeAtom } from "./atoms/theme.js"
import type { PageRoute } from "./services/path.js"
import { DeepDivePage } from "./view/deep/DeepDivePage.js"
import { DocsPage } from "./view/docs/DocsPage.js"
import { HomePage } from "./view/home/HomePage.js"

import "./styles.css"

const RoutePreloader = ({ route }: { readonly route: PageRoute }) => {
  useAtomValue(routePreloadMountAtom(preloadRouteKey(route)))
  return null
}

const applyColorMode = (mode: ColorMode) => {
  document.documentElement.classList.toggle("dark", mode === "dark")
}

const ThemeApplicator = () => {
  useAtomSubscribe(colorModeAtom, applyColorMode, { immediate: true })

  return null
}

const AppShell = ({ route }: { readonly route: PageRoute }) => (
  <>
    <ThemeApplicator />
    <RoutePreloader route={route} />
    {Match.value(route).pipe(
      Match.tag("HomeRoute", () => <HomePage />),
      Match.tag("DeepRoute", ({ id }) => <DeepDivePage id={id} />),
      Match.tag("DocsIndexRoute", (docsRoute) => <DocsPage route={docsRoute} />),
      Match.tag("DocsOverviewRoute", (docsRoute) => <DocsPage route={docsRoute} />),
      Match.tag("DocsGuideRoute", (docsRoute) => <DocsPage route={docsRoute} />),
      Match.tag("DocsApiRoute", (docsRoute) => <DocsPage route={docsRoute} />),
      Match.tag("DocsNotFoundRoute", (docsRoute) => <DocsPage route={docsRoute} />),
      Match.exhaustive
    )}
  </>
)

export const App = ({ route }: { readonly route: PageRoute }) => (
  <RegistryProvider defaultIdleTTL={400}>
    <Tooltip.Provider>
      <AppShell route={route} />
    </Tooltip.Provider>
  </RegistryProvider>
)
