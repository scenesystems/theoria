import { Tooltip } from "@base-ui-components/react/tooltip"
import { RegistryProvider, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import { useEffect } from "react"

import type { PageLocation } from "../contracts/presentation/page-location.js"
import { PagePresentation } from "../contracts/presentation/page.js"
import { preloadRouteKey, routePreloadMountAtom } from "./atoms/surface/preload.js"
import { colorModeAtom } from "./atoms/theme.js"
import { PackageDocsPage } from "./view/docs/PackageDocsPage.js"
import { EntryPage } from "./view/entry/EntryPage.js"
import { HomePage } from "./view/home/HomePage.js"

import "./styles.css"

const RoutePreloader = ({ route }: { readonly route: PagePresentation.Value["route"] }) => {
  useAtomValue(routePreloadMountAtom.atom(preloadRouteKey(route)))
  return null
}

const ThemeApplicator = () => {
  const mode = useAtomValue(colorModeAtom)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark")
  }, [mode])

  return null
}

const AppShell = ({
  location
}: {
  readonly location: PageLocation
}) => {
  const page = PagePresentation.fromLocation(location)

  return (
    <>
      <ThemeApplicator />
      <RoutePreloader route={page.route} />
      {Match.value(page).pipe(
        Match.tag("HomePagePresentation", (value) => <HomePage metadata={value.metadata} />),
        Match.tag("EntryPagePresentation", (value) => <EntryPage entry={value.entry} metadata={value.metadata} />),
        Match.tag(
          "PackageDocsPagePresentation",
          (value) => <PackageDocsPage metadata={value.metadata} route={value.packageDocsRoute} />
        ),
        Match.exhaustive
      )}
    </>
  )
}

export const App = ({
  location
}: {
  readonly location: PageLocation
}) => (
  <RegistryProvider defaultIdleTTL={400}>
    <Tooltip.Provider>
      <AppShell location={location} />
    </Tooltip.Provider>
  </RegistryProvider>
)
