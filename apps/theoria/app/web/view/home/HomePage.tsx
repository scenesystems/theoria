import { appTheme } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { SiteFooter } from "../primitives/SiteFooter.js"
import { SiteHeader } from "../primitives/SiteHeader.js"

import { HomeHero } from "./HomeHero.js"
import { PlaceActs } from "./PlaceActs.js"

/** The page is the canvas: the header, the hero, the demonstration, the footer. Nothing floats above them. */
export const HomePage = () => (
  <Layer render={<main />} className={appTheme.root}>
    <Layer className={appTheme.content}>
      <SiteHeader />
      <HomeHero />
      <PlaceActs />
      <SiteFooter />
    </Layer>
  </Layer>
)
