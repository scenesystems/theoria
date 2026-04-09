import { Tooltip } from "@base-ui-components/react/tooltip"
import { RegistryProvider, useAtomValue } from "@effect-atom/atom-react"
import { useEffect } from "react"

import type { PageRoute } from "../contracts/presentation/path.js"
import { preloadRouteKey, routePreloadMountAtom } from "./atoms/surface/preload.js"
import { colorModeAtom } from "./atoms/theme.js"
import { DeepDivePage } from "./view/deep/DeepDivePage.js"
import { PackageDocsPage } from "./view/docs/PackageDocsPage.js"
import { HomePage } from "./view/home/HomePage.js"

import "./styles.css"

const RoutePreloader = ({ route }: { readonly route: PageRoute }) => {
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

const AppShell = ({ route }: { readonly route: PageRoute }) => (
  <>
    <ThemeApplicator />
    <RoutePreloader route={route} />
    {route._tag === "DeepRoute"
      ? <DeepDivePage entryId={route.entryId} />
      : route._tag === "PackageDocsRoute"
      ? <PackageDocsPage route={route.route} />
      : <HomePage />}
  </>
)

export const App = ({ route }: { readonly route: PageRoute }) => (
  <RegistryProvider defaultIdleTTL={400}>
    <Tooltip.Provider>
      <AppShell route={route} />
    </Tooltip.Provider>
  </RegistryProvider>
)
