import { Tooltip } from "@base-ui-components/react/tooltip"
import { RegistryProvider, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import { browserMetadataMountAtom, browserNavigationMountAtom, pageRouteAtom } from "./atoms/navigation.js"
import { type ColorMode, colorModeAtom } from "./atoms/theme.js"
import { DocsPage } from "./view/docs/DocsPage.js"
import { HomePage } from "./view/home/HomePage.js"

import "./styles.css"

const applyColorMode = (mode: ColorMode) => {
  document.documentElement.classList.toggle("dark", mode === "dark")
}

const ThemeApplicator = () => {
  useAtomSubscribe(colorModeAtom, applyColorMode, { immediate: true })

  return null
}

const AppShell = () => {
  useAtomValue(browserNavigationMountAtom)
  useAtomValue(browserMetadataMountAtom)
  const route = useAtomValue(pageRouteAtom)

  return (
    <>
      <ThemeApplicator />
      {Match.value(route).pipe(
        Match.tag("HomeRoute", () => <HomePage />),
        Match.tag("DocsIndexRoute", (docsRoute) => <DocsPage route={docsRoute} />),
        Match.tag("DocsOverviewRoute", (docsRoute) => <DocsPage route={docsRoute} />),
        Match.tag("DocsGuideRoute", (docsRoute) => <DocsPage route={docsRoute} />),
        Match.tag("DocsApiRoute", (docsRoute) => <DocsPage route={docsRoute} />),
        Match.tag("DocsNotFoundRoute", (docsRoute) => <DocsPage route={docsRoute} />),
        Match.exhaustive
      )}
    </>
  )
}

export const App = () => (
  <RegistryProvider defaultIdleTTL={400}>
    <Tooltip.Provider>
      <AppShell />
    </Tooltip.Provider>
  </RegistryProvider>
)
