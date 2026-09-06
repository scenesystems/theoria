import { appTheme } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"

import { HomeHero } from "./HomeHero.js"
import { ImaginedPlaceDemo } from "./ImaginedPlaceDemo.js"

export const HomePage = () => (
  <Layer render={<main />} className={appTheme.root}>
    <Layer className={appTheme.content}>
      <SiteHeader />
      <HomeHero />
      <ImaginedPlaceDemo />
      <SiteFooter />
    </Layer>
  </Layer>
)
